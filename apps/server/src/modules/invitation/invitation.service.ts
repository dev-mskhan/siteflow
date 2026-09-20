// apps/server/src/modules/invitation/invitation.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../lib/db/index.js';
import { InvitationRepository, type InvitationWithRole } from './invitation.repository.js';
import { MembershipRepository } from '../membership/membership.repository.js';
import { OrganizationRepository } from '../organization/organization.repository.js';
import { auditService } from '../audit/audit.service.js';
import { writeOutboxEvent } from '../../lib/outbox/outbox.service.js';
import { generateOneTimeToken, hashOneTimeToken } from '../auth/token.service.js';
import { ORG_QUEUES } from './invitation.jobs.js';
import { NotFoundError, ConflictError, ValidationError } from './invitation.errors.js';
import type { InvitationDTO, CreateInvitationInput } from './invitation.types.js';
import type { OrganizationContext } from '../rbac/rbac.types.js';
import { eq, and } from 'drizzle-orm';
import type { Invitation } from '@siteflow/database/schema';
import { organizationMemberships, users, roles } from '@siteflow/database/schema';

const logger = createLogger({ name: 'invitation-service' });
const tracer = trace.getTracer('invitation-service');

export function toInvitationDTO(invite: InvitationWithRole | Invitation): InvitationDTO {
  const withRole = invite as InvitationWithRole;
  return {
    id: invite.id,
    organizationId: invite.organizationId,
    email: invite.email,
    roleId: invite.roleId,
    roleName: withRole.roleName,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
    invitedBy: invite.invitedBy,
    createdAt: invite.createdAt.toISOString(),
  };
}

export class InvitationService {
  constructor(
    private repo = new InvitationRepository(),
    private membershipRepo = new MembershipRepository(),
    private orgRepo = new OrganizationRepository(),
  ) {}

  private get db() {
    return getDb();
  }

  async createInvitation(
    orgId: string,
    actorCtx: OrganizationContext,
    input: CreateInvitationInput,
  ): Promise<InvitationDTO> {
    return withSpan(tracer, 'invitation.createInvitation', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('user.id', actorCtx.userId);
      span.setAttribute('invitee.email', input.email);
      logger.info({ orgId, email: input.email }, 'Creating organization invitation');

      // 1. Check if org exists
      const org = await this.orgRepo.findById(orgId);
      if (!org) throw new NotFoundError('Organization not found');

      // 1b. Check if role belongs to this organization
      const targetRole = await this.db
        .select()
        .from(roles)
        .where(and(eq(roles.id, input.roleId), eq(roles.organizationId, orgId)))
        .limit(1);

      if (!targetRole[0]) {
        throw new ValidationError('Role does not belong to this organization');
      }

      // 2. Check existing active membership (if user already registered)
      const existingUser = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (existingUser[0]) {
        const existingMember = await this.membershipRepo.findByOrgAndUser(orgId, existingUser[0].id);
        if (existingMember) {
          throw new ConflictError('User is already a member of this organization');
        }
      }

      // 3. Check existing pending invitation
      const pendingInvite = await this.repo.findPendingByOrgAndEmail(orgId, input.email);
      if (pendingInvite) {
        throw new ConflictError('Pending invitation already exists for this email');
      }

      const { raw: rawToken, hash: tokenHash } = generateOneTimeToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const created = await this.db.transaction(async (tx) => {
        // Create Invitation row
        const invite = await this.repo.create(
          {
            organizationId: orgId,
            email: input.email,
            roleId: input.roleId,
            tokenHash,
            expiresAt,
            invitedBy: actorCtx.userId,
            status: 'PENDING',
          },
          tx,
        );

        span.setAttribute('invitation.id', invite.id);

        // Write Outbox Event for async queue processing
        await writeOutboxEvent(tx, ORG_QUEUES.SEND_INVITATION_EMAIL, {
          invitationId: invite.id,
          organizationId: orgId,
          email: input.email,
          orgName: input.orgName ?? org.name,
          inviterName: input.inviterName ?? 'Organization Admin',
          token: rawToken,
        });

        // Audit log
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId: actorCtx.userId,
            action: 'member.invited',
            resourceType: 'Invitation',
            resourceId: invite.id,
            metadata: { email: input.email, roleId: input.roleId },
          },
          tx,
        );

        return invite;
      });

      return toInvitationDTO(created);
    });
  }

  async listInvitations(orgId: string): Promise<InvitationDTO[]> {
    return withSpan(tracer, 'invitation.listInvitations', async (span) => {
      span.setAttribute('organization.id', orgId);
      const invites = await this.repo.findByOrg(orgId);
      return invites.map(toInvitationDTO);
    });
  }

  async cancelInvitation(
    orgId: string,
    invitationId: string,
    actorCtx: OrganizationContext,
  ): Promise<void> {
    return withSpan(tracer, 'invitation.cancelInvitation', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('invitation.id', invitationId);
      span.setAttribute('user.id', actorCtx.userId);

      const invite = await this.repo.findById(invitationId);
      if (!invite || invite.organizationId !== orgId) {
        throw new NotFoundError('Invitation not found');
      }

      if (invite.status !== 'PENDING') {
        throw new ValidationError('Only pending invitations can be cancelled');
      }

      await this.db.transaction(async (tx) => {
        await this.repo.updateStatus(invitationId, 'CANCELLED', tx);
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId: actorCtx.userId,
            action: 'invitation.cancelled',
            resourceType: 'Invitation',
            resourceId: invitationId,
          },
          tx,
        );
      });
    });
  }

  async acceptInvitation(rawToken: string, userId: string): Promise<void> {
    return withSpan(tracer, 'invitation.acceptInvitation', async (span) => {
      span.setAttribute('user.id', userId);

      const tokenHash = hashOneTimeToken(rawToken);
      const invite = await this.repo.findValidPending(tokenHash);

      if (!invite) {
        throw new NotFoundError('Invitation not found or invalid');
      }

      span.setAttribute('organization.id', invite.organizationId);
      span.setAttribute('invitation.id', invite.id);

      if (invite.expiresAt < new Date()) {
        throw new ValidationError('Invitation has expired');
      }

      await this.db.transaction(async (tx) => {
        // 1. Create Organization Membership
        await tx.insert(organizationMemberships).values({
          organizationId: invite.organizationId,
          userId,
          roleId: invite.roleId,
          status: 'ACTIVE',
          joinedAt: new Date(),
        });

        // 2. Mark Invitation ACCEPTED
        await this.repo.updateStatus(invite.id, 'ACCEPTED', tx);

        // 3. Audit log
        await auditService.log(
          {
            organizationId: invite.organizationId,
            actorUserId: userId,
            action: 'member.joined',
            resourceType: 'Membership',
            resourceId: invite.organizationId,
            metadata: { invitationId: invite.id },
          },
          tx,
        );
      });
    });
  }
}
