// apps/server/src/modules/invitation/invitation.service.ts
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
import type { Invitation } from '@siteflow/database/schema';
import { organizationMemberships } from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'invitation-service' });

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
    logger.info({ orgId, email: input.email }, 'Creating organization invitation');

    // 1. Check if org exists
    const org = await this.orgRepo.findById(orgId);
    if (!org) throw new NotFoundError('Organization not found');

    // 2. Check existing active membership
    const existingMember = await this.membershipRepo.findByOrgAndUser(orgId, input.email);
    if (existingMember) {
      throw new ConflictError('User is already a member of this organization');
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
  }

  async listInvitations(orgId: string): Promise<InvitationDTO[]> {
    const invites = await this.repo.findByOrg(orgId);
    return invites.map(toInvitationDTO);
  }

  async cancelInvitation(
    orgId: string,
    invitationId: string,
    actorCtx: OrganizationContext,
  ): Promise<void> {
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
  }

  async acceptInvitation(rawToken: string, userId: string): Promise<void> {
    const tokenHash = hashOneTimeToken(rawToken);
    const invite = await this.repo.findValidPending(tokenHash);

    if (!invite) {
      throw new NotFoundError('Invitation not found or invalid');
    }

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
  }
}
