// apps/server/src/modules/membership/membership.service.ts
import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { getDb } from '../../lib/db/index.js';
import { MembershipRepository, type MemberWithDetails } from './membership.repository.js';
import { rbacCacheService } from '../rbac/rbac.cache.service.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from './membership.errors.js';
import type { MemberDTO, UpdateMemberInput } from './membership.types.js';
import type { OrganizationContext } from '../rbac/rbac.types.js';
import { eq, and } from 'drizzle-orm';
import { roles, type Membership } from '@siteflow/database/schema';

const tracer = trace.getTracer('membership-service');

export function toMemberDTO(member: MemberWithDetails | Membership): MemberDTO {
  const withDetails = member as MemberWithDetails;
  return {
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
    roleId: member.roleId,
    roleName: withDetails.roleName,
    userEmail: withDetails.userEmail,
    userFirstName: withDetails.userFirstName,
    userLastName: withDetails.userLastName ?? null,
    status: member.status,
    joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

export class MembershipService {
  constructor(private repo = new MembershipRepository()) {}

  private get db() {
    return getDb();
  }

  private assertSameTenant(membership: Membership, orgId: string): void {
    if (membership.organizationId !== orgId) {
      throw new ForbiddenError('Membership does not belong to this organization');
    }
  }

  private async assertNotLastAdmin(orgId: string, targetMembership: Membership): Promise<void> {
    const targetMember = await this.repo.findMemberWithDetails(targetMembership.id, orgId);
    if (targetMember?.roleName === 'Organization Admin') {
      const adminCount = await this.repo.countActiveAdmins(orgId);
      if (adminCount <= 1) {
        throw new ValidationError('Cannot modify or remove the last Organization Admin');
      }
    }
  }

  async listMembers(orgId: string): Promise<MemberDTO[]> {
    return withSpan(tracer, 'membership.listMembers', async (span) => {
      span.setAttribute('organization.id', orgId);
      const members = await this.repo.findByOrg(orgId);
      return members.map(toMemberDTO);
    });
  }

  async getMember(orgId: string, memberId: string): Promise<MemberDTO> {
    return withSpan(tracer, 'membership.getMember', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('membership.id', memberId);

      const member = await this.repo.findMemberWithDetails(memberId, orgId);
      if (!member || member.status === 'REMOVED') {
        throw new NotFoundError('Member not found');
      }
      return toMemberDTO(member);
    });
  }

  async updateMember(
    orgId: string,
    memberId: string,
    actorCtx: OrganizationContext,
    input: UpdateMemberInput,
  ): Promise<MemberDTO> {
    return withSpan(tracer, 'membership.updateMember', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('membership.id', memberId);
      span.setAttribute('user.id', actorCtx.userId);

      const existing = await this.repo.findById(memberId, orgId);
      if (!existing || existing.status === 'REMOVED') {
        throw new NotFoundError('Member not found');
      }

      if (input.roleId) {
        const targetRole = await this.db
          .select()
          .from(roles)
          .where(and(eq(roles.id, input.roleId), eq(roles.organizationId, orgId)))
          .limit(1);

        if (!targetRole[0]) {
          throw new ValidationError('Role does not belong to this organization');
        }
      }

      // Guard if demoting or suspending an existing Organization Admin
      if (input.roleId || input.status === 'SUSPENDED') {
        const currentMember = await this.repo.findMemberWithDetails(memberId, orgId);
        if (currentMember?.roleName === 'Organization Admin') {
          await this.assertNotLastAdmin(orgId, existing);
        }
      }

      const updated = await this.db.transaction(async (tx) => {
        const result = await this.repo.update(memberId, input, tx);

        // Determine specific audit action based on what changed
        let action: string;
        if (input.roleId) {
          action = 'member.role_changed';
        } else if (input.status === 'SUSPENDED') {
          action = 'member.suspended';
        } else if (input.status === 'ACTIVE') {
          action = 'member.reactivated';
        } else {
          action = 'member.updated';
        }

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId: actorCtx.userId,
            action,
            resourceType: 'Membership',
            resourceId: memberId,
            metadata: input as Record<string, unknown>,
          },
          tx,
        );
        return result;
      });

      // Synchronous cache invalidation AFTER transaction commit
      await rbacCacheService.invalidate(orgId, existing.userId);

      const refreshed = await this.repo.findMemberWithDetails(memberId, orgId);
      return toMemberDTO(refreshed ?? updated);
    });
  }

  async removeMember(
    orgId: string,
    memberId: string,
    actorCtx: OrganizationContext,
  ): Promise<void> {
    return withSpan(tracer, 'membership.removeMember', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('membership.id', memberId);
      span.setAttribute('user.id', actorCtx.userId);

      const existing = await this.repo.findById(memberId, orgId);
      if (!existing || existing.status === 'REMOVED') {
        throw new NotFoundError('Member not found');
      }

      this.assertSameTenant(existing, orgId);
      await this.assertNotLastAdmin(orgId, existing);

      await this.db.transaction(async (tx) => {
        await this.repo.softRemove(memberId, tx);
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId: actorCtx.userId,
            action: 'member.removed',
            resourceType: 'Membership',
            resourceId: memberId,
          },
          tx,
        );
      });

      // Synchronous cache invalidation AFTER transaction commit
      await rbacCacheService.invalidate(orgId, existing.userId);
    });
  }
}
