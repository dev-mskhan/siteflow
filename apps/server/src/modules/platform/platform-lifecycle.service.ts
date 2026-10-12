// apps/server/src/modules/platform/platform-lifecycle.service.ts
import { and, eq, inArray, ne } from 'drizzle-orm';
import {
  organizationMemberships,
  organizations,
  platformApprovals,
  saasSubscriptions,
  users,
} from '@siteflow/database/schema';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../lib/db/index.js';
import { writeOutboxEvent } from '../../lib/outbox/outbox.service.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthCacheService } from '../auth/auth.cache.service.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../auth/auth.errors.js';
import { verifyPassword } from '../auth/password.service.js';

export const ORG_SUSPEND_ACTION = 'organization.suspend';

// Subscription states that block reactivation until billing is resolved.
const REACTIVATION_BLOCKING_SUBSCRIPTION_STATUSES = ['UNPAID', 'RESTRICTED', 'CANCELED'] as const;

export const LIFECYCLE_REASON_CODES = [
  'SECURITY_INCIDENT',
  'FRAUD',
  'POLICY_VIOLATION',
  'CUSTOMER_REQUEST',
  'OTHER',
] as const;
export type LifecycleReasonCode = (typeof LIFECYCLE_REASON_CODES)[number];

export interface LifecycleActionInput {
  actorUserId: string;
  password: string;
  reasonCode: LifecycleReasonCode;
  reasonNote: string;
}

export class PlatformLifecycleService {
  private readonly authRepo = new AuthRepository();
  private readonly authCache = new AuthCacheService();

  private async assertReauthenticated(actorUserId: string, password: string): Promise<void> {
    const actor = await this.authRepo.findUserById(actorUserId);
    if (!actor?.passwordHash || !(await verifyPassword(password, actor.passwordHash))) {
      throw new UnauthorizedError('Password confirmation failed');
    }
  }

  async suspendAccount(targetUserId: string, input: LifecycleActionInput): Promise<void> {
    if (targetUserId === input.actorUserId) {
      throw new ForbiddenError('Operators cannot suspend their own account');
    }
    await this.assertReauthenticated(input.actorUserId, input.password);

    await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set({ status: 'SUSPENDED' })
        .where(and(eq(users.id, targetUserId), eq(users.status, 'ACTIVE')))
        .returning({ id: users.id });
      if (updated.length === 0) {
        throw new ConflictError('Account is not in a state that allows suspension');
      }
      await writeOutboxEvent(tx, 'platform.account.suspended', {
        targetUserId,
        actorUserId: input.actorUserId,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
      });
    });

    await this.authRepo.revokeAllUserSessions(targetUserId);
    await this.authCache.invalidateAllUserCaches(targetUserId);
  }

  async reactivateAccount(targetUserId: string, input: LifecycleActionInput): Promise<void> {
    await this.assertReauthenticated(input.actorUserId, input.password);

    await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set({ status: 'ACTIVE' })
        .where(and(eq(users.id, targetUserId), eq(users.status, 'SUSPENDED')))
        .returning({ id: users.id });
      if (updated.length === 0) {
        throw new ConflictError('Account is not suspended');
      }
      await writeOutboxEvent(tx, 'platform.account.reactivated', {
        targetUserId,
        actorUserId: input.actorUserId,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
      });
    });

    await this.authCache.invalidateAllUserCaches(targetUserId);
  }

  async requestOrganizationSuspension(
    organizationId: string,
    input: LifecycleActionInput,
  ): Promise<{ approvalId: string }> {
    await this.assertReauthenticated(input.actorUserId, input.password);

    return getDb().transaction(async (tx) => {
      const [org] = await tx
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, organizationId));
      if (!org || org.status !== 'ACTIVE') {
        throw new ConflictError('Organization is not in a state that allows suspension');
      }
      const approvalId = randomUUID();
      await tx.insert(platformApprovals).values({
        id: approvalId,
        actionKey: ORG_SUSPEND_ACTION,
        targetType: 'organization',
        targetId: organizationId,
        requestedByUserId: input.actorUserId,
        status: 'pending',
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
      });
      await writeOutboxEvent(
        tx,
        'platform.organization.suspension_requested',
        { organizationId, approvalId, actorUserId: input.actorUserId, reasonCode: input.reasonCode },
        organizationId,
      );
      return { approvalId };
    });
  }

  async approveOrganizationSuspension(approvalId: string, input: LifecycleActionInput): Promise<void> {
    await this.assertReauthenticated(input.actorUserId, input.password);

    const organizationId = await getDb().transaction(async (tx) => {
      const claimed = await tx
        .update(platformApprovals)
        .set({ status: 'approved', approvedByUserId: input.actorUserId, decidedAt: new Date() })
        .where(
          and(
            eq(platformApprovals.id, approvalId),
            eq(platformApprovals.status, 'pending'),
            eq(platformApprovals.actionKey, ORG_SUSPEND_ACTION),
            ne(platformApprovals.requestedByUserId, input.actorUserId),
          ),
        )
        .returning({ targetId: platformApprovals.targetId });
      if (claimed.length === 0) {
        throw new ConflictError('Approval is not pending or cannot be approved by this operator');
      }
      const organizationId = claimed[0].targetId;

      const suspended = await tx
        .update(organizations)
        .set({ status: 'SUSPENDED' })
        .where(and(eq(organizations.id, organizationId), eq(organizations.status, 'ACTIVE')))
        .returning({ id: organizations.id });
      if (suspended.length === 0) {
        throw new ConflictError('Organization is not in a state that allows suspension');
      }
      await writeOutboxEvent(
        tx,
        'platform.organization.suspended',
        {
          organizationId,
          approvalId,
          actorUserId: input.actorUserId,
          reasonCode: input.reasonCode,
          reasonNote: input.reasonNote,
        },
        organizationId,
      );
      return organizationId;
    });

    // Revoke member sessions after commit so a revocation failure cannot roll back the suspension.
    const members = await getDb()
      .select({ userId: organizationMemberships.userId })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.status, 'ACTIVE'),
        ),
      );
    for (const member of members) {
      await this.authRepo.revokeAllUserSessions(member.userId);
      await this.authCache.invalidateAllUserCaches(member.userId);
    }
  }

  async reactivateOrganization(organizationId: string, input: LifecycleActionInput): Promise<void> {
    await this.assertReauthenticated(input.actorUserId, input.password);

    await getDb().transaction(async (tx) => {
      const [blocking] = await tx
        .select({ status: saasSubscriptions.status })
        .from(saasSubscriptions)
        .where(
          and(
            eq(saasSubscriptions.organizationId, organizationId),
            eq(saasSubscriptions.isCurrent, true),
            inArray(saasSubscriptions.status, [...REACTIVATION_BLOCKING_SUBSCRIPTION_STATUSES]),
          ),
        )
        .limit(1);
      if (blocking) {
        throw new ConflictError(
          `Organization cannot be reactivated while subscription is ${blocking.status}`,
        );
      }

      const updated = await tx
        .update(organizations)
        .set({ status: 'ACTIVE' })
        .where(and(eq(organizations.id, organizationId), eq(organizations.status, 'SUSPENDED')))
        .returning({ id: organizations.id });
      if (updated.length === 0) {
        throw new ConflictError('Organization is not suspended');
      }
      await writeOutboxEvent(
        tx,
        'platform.organization.reactivated',
        {
          organizationId,
          actorUserId: input.actorUserId,
          reasonCode: input.reasonCode,
          reasonNote: input.reasonNote,
        },
        organizationId,
      );
    });
  }
}

export const platformLifecycleService = new PlatformLifecycleService();
