// apps/server/src/modules/platform/platform-support-grant.service.ts
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import {
  organizationMemberships,
  organizations,
  platformSupportGrants,
  roles,
} from '@siteflow/database/schema';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../lib/db/index.js';
import { writeOutboxEvent } from '../../lib/outbox/outbox.service.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../auth/auth.errors.js';
import { verifyPassword } from '../auth/password.service.js';
import { LIFECYCLE_REASON_CODES, type LifecycleReasonCode } from './platform-lifecycle.service.js';
import { getCurrentSubscriptionSnapshot } from '../billing/reminder-delivery.repository.js';
import { catalogService } from '../billing/catalog.service.js';

// Ordinary, read-only scopes. Sensitive scopes are intentionally absent and always rejected.
export const SUPPORT_GRANT_SCOPES = [
  'read:org_summary',
  'read:org_subscription',
  'read:org_entitlements',
] as const;
export type SupportGrantScope = (typeof SUPPORT_GRANT_SCOPES)[number];

export const SENSITIVE_SUPPORT_SCOPES = [
  'ownership:change',
  'platform_role:change',
  'refund:issue',
  'export:confidential',
] as const;

export const SUPPORT_GRANT_MAX_MINUTES = 24 * 60;

export interface SupportGrantRequestInput {
  actorUserId: string;
  password: string;
  operatorUserId: string;
  organizationId: string;
  reasonCode: LifecycleReasonCode;
  reasonNote: string;
  scopes: SupportGrantScope[];
}

export class PlatformSupportGrantService {
  private readonly authRepo = new AuthRepository();

  private async assertReauthenticated(actorUserId: string, password: string): Promise<void> {
    const actor = await this.authRepo.findUserById(actorUserId);
    if (!actor?.passwordHash || !(await verifyPassword(password, actor.passwordHash))) {
      throw new UnauthorizedError('Password confirmation failed');
    }
  }

  async requestGrant(input: SupportGrantRequestInput): Promise<{ grantId: string }> {
    await this.assertReauthenticated(input.actorUserId, input.password);

    const invalidScope = input.scopes.find(
      (s) => !(SUPPORT_GRANT_SCOPES as readonly string[]).includes(s),
    );
    if (invalidScope || input.scopes.length === 0) {
      throw new ForbiddenError('Requested scope is not available to support grants');
    }
    if (!(LIFECYCLE_REASON_CODES as readonly string[]).includes(input.reasonCode)) {
      throw new ConflictError('Invalid reason code');
    }

    return getDb().transaction(async (tx) => {
      const [org] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId));
      if (!org) {
        throw new ForbiddenError('Support grant could not be requested');
      }
      const grantId = randomUUID();
      await tx.insert(platformSupportGrants).values({
        id: grantId,
        operatorUserId: input.operatorUserId,
        organizationId: input.organizationId,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
        scopes: input.scopes,
        status: 'pending',
        requestedByUserId: input.actorUserId,
      });
      await writeOutboxEvent(
        tx,
        'platform.support_grant.requested',
        {
          grantId,
          operatorUserId: input.operatorUserId,
          organizationId: input.organizationId,
          scopes: input.scopes,
          actorUserId: input.actorUserId,
          reasonCode: input.reasonCode,
        },
        input.organizationId,
      );
      return { grantId };
    });
  }

  async approveGrant(
    grantId: string,
    input: { actorUserId: string; password: string; durationMinutes: number },
  ): Promise<{ expiresAt: Date }> {
    await this.assertReauthenticated(input.actorUserId, input.password);
    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < 1 ||
      input.durationMinutes > SUPPORT_GRANT_MAX_MINUTES
    ) {
      throw new ConflictError('Grant duration must be between 1 and 1440 minutes');
    }

    return getDb().transaction(async (tx) => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + input.durationMinutes * 60_000);
      // Conditional update: only a pending grant, approved by someone other than its requester.
      const updated = await tx
        .update(platformSupportGrants)
        .set({
          status: 'active',
          approvedByUserId: input.actorUserId,
          approvedAt: now,
          expiresAt,
        })
        .where(
          and(
            eq(platformSupportGrants.id, grantId),
            eq(platformSupportGrants.status, 'pending'),
            sql`${platformSupportGrants.requestedByUserId} <> ${input.actorUserId}`,
          ),
        )
        .returning({
          organizationId: platformSupportGrants.organizationId,
          operatorUserId: platformSupportGrants.operatorUserId,
          scopes: platformSupportGrants.scopes,
        });
      if (updated.length === 0) {
        throw new ConflictError('Grant cannot be approved (not pending, or self-approval)');
      }
      const grant = updated[0]!;
      await writeOutboxEvent(
        tx,
        'platform.support_grant.approved',
        {
          grantId,
          operatorUserId: grant.operatorUserId,
          organizationId: grant.organizationId,
          scopes: grant.scopes,
          approvedByUserId: input.actorUserId,
          expiresAt: expiresAt.toISOString(),
        },
        grant.organizationId,
      );
      return { expiresAt };
    });
  }

  async revokeGrant(
    grantId: string,
    input: { actorUserId: string; password: string },
  ): Promise<void> {
    await this.assertReauthenticated(input.actorUserId, input.password);

    await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(platformSupportGrants)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedByUserId: input.actorUserId,
        })
        .where(
          and(
            eq(platformSupportGrants.id, grantId),
            inArray(platformSupportGrants.status, ['pending', 'active']),
          ),
        )
        .returning({
          organizationId: platformSupportGrants.organizationId,
          operatorUserId: platformSupportGrants.operatorUserId,
        });
      if (updated.length === 0) {
        throw new ConflictError('Grant is not pending or active');
      }
      await writeOutboxEvent(
        tx,
        'platform.support_grant.revoked',
        {
          grantId,
          operatorUserId: updated[0]!.operatorUserId,
          organizationId: updated[0]!.organizationId,
          actorUserId: input.actorUserId,
        },
        updated[0]!.organizationId,
      );
    });
  }

  /**
   * Resolves a grant for the calling operator. The organization ID is read from the grant row only.
   * Status, expiry, revocation and operator identity are checked on every call.
   * Denials are audited in their own committed transaction before the error is thrown.
   */
  async useGrant(
    grantId: string,
    actorUserId: string,
    scope: SupportGrantScope,
  ): Promise<{ organizationId: string; organizationName: string; organizationStatus: string }> {
    const now = new Date();
    const outcome = await getDb().transaction(async (tx) => {
      const [grant] = await tx
        .select({
          organizationId: platformSupportGrants.organizationId,
          operatorUserId: platformSupportGrants.operatorUserId,
          scopes: platformSupportGrants.scopes,
          status: platformSupportGrants.status,
          expiresAt: platformSupportGrants.expiresAt,
        })
        .from(platformSupportGrants)
        .where(eq(platformSupportGrants.id, grantId));

      let denyReason: string | null = null;
      if (!grant || grant.operatorUserId !== actorUserId) {
        denyReason = 'not_found_or_not_owner';
      } else if (grant.status !== 'active') {
        denyReason = `status_${grant.status}`;
      } else if (!grant.expiresAt || grant.expiresAt <= now) {
        denyReason = 'expired';
      } else if (!grant.scopes.includes(scope)) {
        denyReason = 'scope_not_granted';
      }

      if (denyReason) {
        if (grant) {
          await writeOutboxEvent(
            tx,
            'platform.support_grant.use_denied',
            {
              organizationId: grant.organizationId,
              grantId,
              actorUserId,
              scope,
              reason: denyReason,
            },
            grant.organizationId,
          );
        }
        return { denyReason, grant: null as null };
      }

      const [org] = await tx
        .select({ name: organizations.name, status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, grant!.organizationId));
      if (!org) {
        return { denyReason: 'organization_missing', grant: null as null };
      }
      await writeOutboxEvent(
        tx,
        'platform.support_grant.used',
        { organizationId: grant!.organizationId, grantId, actorUserId, scope },
        grant!.organizationId,
      );
      return {
        denyReason: null,
        grant: {
          organizationId: grant!.organizationId,
          organizationName: org.name,
          organizationStatus: org.status,
        },
      };
    });

    if (outcome.denyReason || !outcome.grant) {
      throw new ForbiddenError('Support access is not permitted');
    }
    return outcome.grant;
  }

  /**
   * Read-only organization view limited to the granted scope. Membership counts and owner are
   * computed in SQL; subscription and entitlements reuse the billing read paths.
   */
  async getOrganizationView(organizationId: string, scope: SupportGrantScope) {
    if (scope === 'read:org_subscription') {
      return { subscription: await getCurrentSubscriptionSnapshot(organizationId) };
    }
    if (scope === 'read:org_entitlements') {
      return { entitlements: await catalogService.getEffectiveEntitlements(organizationId) };
    }
    const db = getDb();
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    const [owner] = await db
      .select({ userId: organizationMemberships.userId })
      .from(organizationMemberships)
      .innerJoin(roles, eq(roles.id, organizationMemberships.roleId))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(roles.name, 'Organization Admin'),
          eq(roles.isSystem, true),
          ne(organizationMemberships.status, 'REMOVED'),
        ),
      )
      .limit(1);
    const [counts] = await db
      .select({ memberCount: sql<number>`count(*)::int` })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          ne(organizationMemberships.status, 'REMOVED'),
        ),
      );
    return {
      organization: org ? { ...org, ownerUserId: owner?.userId ?? null, memberCount: counts?.memberCount ?? 0 } : null,
    };
  }

  /** Marks active grants past expiry as expired. Safe to run repeatedly. */
  async expireDueGrants(): Promise<number> {
    const rows = await getDb()
      .update(platformSupportGrants)
      .set({ status: 'expired' })
      .where(
        and(
          eq(platformSupportGrants.status, 'active'),
          isNull(platformSupportGrants.revokedAt),
          sql`${platformSupportGrants.expiresAt} <= now()`,
        ),
      )
      .returning({ id: platformSupportGrants.id });
    return rows.length;
  }
}

export const platformSupportGrantService = new PlatformSupportGrantService();
