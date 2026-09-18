// apps/server/src/modules/membership/membership.service.ts
import { getDb } from '../../lib/db/index.js';
import { MembershipRepository, type MemberWithDetails } from './membership.repository.js';
import { rbacCacheService } from '../rbac/rbac.cache.service.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from './membership.errors.js';
import type { MemberDTO, UpdateMemberInput } from './membership.types.js';
import type { OrganizationContext } from '../rbac/rbac.types.js';
import type { Membership } from '@siteflow/database/schema';

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

  private async assertNotLastAdmin(orgId: string, _targetMembership: Membership): Promise<void> {
    const adminCount = await this.repo.countActiveAdmins(orgId);
    if (adminCount <= 1) {
      throw new ValidationError('Cannot modify or remove the last Organization Admin');
    }
  }

  async listMembers(orgId: string): Promise<MemberDTO[]> {
    const members = await this.repo.findByOrg(orgId);
    return members.map(toMemberDTO);
  }

  async getMember(orgId: string, memberId: string): Promise<MemberDTO> {
    const member = await this.repo.findMemberWithDetails(memberId);
    if (!member || member.status === 'REMOVED') {
      throw new NotFoundError('Member not found');
    }
    this.assertSameTenant(member, orgId);
    return toMemberDTO(member);
  }

  async updateMember(
    orgId: string,
    memberId: string,
    actorCtx: OrganizationContext,
    input: UpdateMemberInput,
  ): Promise<MemberDTO> {
    const existing = await this.repo.findById(memberId);
    if (!existing || existing.status === 'REMOVED') {
      throw new NotFoundError('Member not found');
    }
    this.assertSameTenant(existing, orgId);

    // Guard if demoting or suspending an admin
    if (input.roleId || input.status === 'SUSPENDED') {
      await this.assertNotLastAdmin(orgId, existing);
    }

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repo.update(memberId, input, tx);
      await auditService.log(
        {
          organizationId: orgId,
          actorUserId: actorCtx.userId,
          action: input.roleId ? 'member.role_changed' : 'member.updated',
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

    const refreshed = await this.repo.findMemberWithDetails(memberId);
    return toMemberDTO(refreshed ?? updated);
  }

  async removeMember(
    orgId: string,
    memberId: string,
    actorCtx: OrganizationContext,
  ): Promise<void> {
    const existing = await this.repo.findById(memberId);
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
  }
}
