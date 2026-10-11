// apps/server/src/modules/billing/entitlement.service.ts
// Phase 10 — Plan 11: Transactional entitlement admission
// Enforces approved limits atomically in PostgreSQL at consuming operation boundaries.

import { count, eq, and, gt, ne, notInArray, sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  projects,
  organizationMemberships,
  invitations,
} from '@siteflow/database/schema';
import {
  saasTrials,
  saasSubscriptions,
} from '@siteflow/database/schema';
import {
  APPROVED_LIMITS,
  type PlanLimits,
  type PlanId,
} from '@siteflow/shared';
import {
  checkEntitlementLimit,
  checkRestrictedStateAccess,
  resolveEntitlementState,
  isWithinGracePeriod,
  type SubscriptionState,
} from './entitlement.policy.js';
import { ForbiddenError } from '../auth/auth.errors.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'entitlement-service' });

// Statuses excluded from the active-projects count (D-04)
const NON_ACTIVE_PROJECT_STATUSES: ('COMPLETED' | 'CANCELLED' | 'ARCHIVED')[] = [
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
];

// ── EntitlementError ──────────────────────────────────────────────────────────

/**
 * Thrown when an entitlement limit is exceeded or the subscription state blocks the operation.
 * Maps to HTTP 403 with a LIMIT_EXCEEDED or ACCESS_RESTRICTED code (D-04, D-09).
 */
export class EntitlementError extends ForbiddenError {
  override readonly code: 'LIMIT_EXCEEDED' | 'ACCESS_RESTRICTED' | 'NO_ENTITLEMENT';
  public readonly entitlementCode: 'LIMIT_EXCEEDED' | 'ACCESS_RESTRICTED' | 'NO_ENTITLEMENT';
  public readonly dimension?: string;
  public readonly current?: number;
  public readonly limit?: number;

  constructor(params: {
    message: string;
    entitlementCode: 'LIMIT_EXCEEDED' | 'ACCESS_RESTRICTED' | 'NO_ENTITLEMENT';
    dimension?: string;
    current?: number;
    limit?: number;
  }) {
    super(params.message);
    this.name = 'EntitlementError';
    this.code = params.entitlementCode;
    this.entitlementCode = params.entitlementCode;
    this.dimension = params.dimension;
    this.current = params.current;
    this.limit = params.limit;
  }
}

// ── EntitlementService ────────────────────────────────────────────────────────

export class EntitlementService {
  // ── Resolve effective limits for an organization ──────────────────────────

  /**
   * Resolves the effective entitlement limits for an organization.
   * Checks (in priority order):
   *   1. Active paid subscription → plan limits
   *   2. Active trial → Professional-tier limits (D-01)
   *   3. None → null (no entitlement)
   *
   * Also returns the current subscription state for gate checks.
   */
  async resolveEffectiveLimits(
    organizationId: string,
    tx?: any,
  ): Promise<{
    limits: PlanLimits | null;
    state: SubscriptionState;
    graceStartsAt: Date | null;
  }> {
    const db = tx ?? getDb();

    // Check paid subscription first
    const sub = await db
      .select({
        planId: saasSubscriptions.planId,
        status: saasSubscriptions.status,
        graceStartsAt: saasSubscriptions.graceStartsAt,
        currentPeriodEnd: saasSubscriptions.currentPeriodEnd,
      })
      .from(saasSubscriptions)
      .where(
        and(
          eq(saasSubscriptions.organizationId, organizationId),
          eq(saasSubscriptions.isCurrent, true),
        ),
      )
      .limit(1);

    if (sub[0]) {
      const dbStatus = sub[0].status as string;
      const graceStartsAt = sub[0].graceStartsAt ?? null;

      // Map DB status to entitlement state
      const stateMap: Record<string, SubscriptionState> = {
        TRIALING: 'TRIALING',
        ACTIVE: 'ACTIVE',
        PAST_DUE: 'PAST_DUE',
        CANCELED: 'CANCELED',
        UNPAID: 'UNPAID',
        RESTRICTED: 'RESTRICTED',
      };
      const state = (stateMap[dbStatus] ?? 'NO_SUBSCRIPTION') as SubscriptionState;

      // For PAST_DUE, check grace window
      const gracePeriodActive = state === 'PAST_DUE' && isWithinGracePeriod(graceStartsAt);
      const paidThroughPeriod =
        state === 'CANCELED' &&
        sub[0].currentPeriodEnd !== null &&
        sub[0].currentPeriodEnd > new Date();
      const entitlementState = resolveEntitlementState(state, gracePeriodActive, paidThroughPeriod);

      if (entitlementState.canPerformLimitedOps) {
        // Resolve limits from the local approved catalog (never trust DB limits column directly)
        const planId = sub[0].planId as PlanId;
        const limits = APPROVED_LIMITS[planId] ?? null;
        return { limits, state: entitlementState.state, graceStartsAt };
      }

      return { limits: null, state: entitlementState.state, graceStartsAt };
    }

    // No paid subscription — check for an active trial
    const trial = await db
      .select({
        status: saasTrials.status,
        expiresAt: saasTrials.expiresAt,
      })
      .from(saasTrials)
      .where(eq(saasTrials.organizationId, organizationId))
      .limit(1);

    if (trial[0] && trial[0].status === 'ACTIVE' && trial[0].expiresAt > new Date()) {
      // Trial provides Professional-tier limits (D-01)
      return {
        limits: APPROVED_LIMITS.professional,
        state: 'TRIALING',
        graceStartsAt: null,
      };
    }

    return { limits: null, state: 'NO_SUBSCRIPTION', graceStartsAt: null };
  }

  // ── Count active projects for an organization ─────────────────────────────

  /**
   * Counts all non-CANCELLED, non-ARCHIVED projects for the organization.
   * Must be called inside a PostgreSQL transaction for race-safe admission.
   */
  async countActiveProjects(organizationId: string, tx: any): Promise<number> {
    const result = await tx
      .select({ cnt: count() })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, organizationId),
          notInArray(projects.status, NON_ACTIVE_PROJECT_STATUSES),
        ),
      );
    return Number(result[0]?.cnt ?? 0);
  }

  // ── Count active org members ──────────────────────────────────────────────

  /**
   * Counts all ACTIVE organization memberships (team members limit = org users per D-04).
   * Must be called inside a PostgreSQL transaction for race-safe admission.
   */
  async countActiveOrgMembers(organizationId: string, tx: any): Promise<number> {
    const result = await tx
      .select({ cnt: count() })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          ne(organizationMemberships.status, 'REMOVED'),
        ),
      );
    return Number(result[0]?.cnt ?? 0);
  }

  async countPendingInvitations(
    organizationId: string,
    tx: any,
    excludedInvitationId?: string,
  ): Promise<number> {
    const filters = [
      eq(invitations.organizationId, organizationId),
      eq(invitations.status, 'PENDING'),
      gt(invitations.expiresAt, new Date()),
    ];
    if (excludedInvitationId) {
      filters.push(ne(invitations.id, excludedInvitationId));
    }

    const result = await tx
      .select({ cnt: count() })
      .from(invitations)
      .where(and(...filters));
    return Number(result[0]?.cnt ?? 0);
  }

  async lockOrganizationUsage(organizationId: string, tx: any): Promise<void> {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`siteflow-entitlement:${organizationId}`}, 0))`,
    );
  }

  // ── Admission gates ───────────────────────────────────────────────────────

  /**
   * Asserts that the organization may create a new project.
   * Checks subscription state and active-projects limit (D-04).
   *
   * MUST be called inside the same PostgreSQL transaction as the project INSERT
   * to prevent race conditions.
   */
  async assertCanCreateProject(organizationId: string, tx: any): Promise<void> {
    await this.lockOrganizationUsage(organizationId, tx);
    const { limits, state } = await this.resolveEffectiveLimits(organizationId, tx);

    if (!limits) {
      logger.warn({ organizationId, state }, 'Project creation blocked: no active subscription or trial');
      throw new EntitlementError({
        message: 'No active subscription or trial. Start a trial or subscribe to create projects.',
        entitlementCode: 'NO_ENTITLEMENT',
      });
    }

    // Restricted-state gate (D-09): project:create is blocked
    const stateCheck = checkRestrictedStateAccess('project:create');
    if (state === 'RESTRICTED' || state === 'UNPAID') {
      throw new EntitlementError({
        message: stateCheck.allowed ? 'Operation allowed' : stateCheck.message,
        entitlementCode: 'ACCESS_RESTRICTED',
      });
    }

    // Count projects under lock in same transaction (race-safe)
    const current = await this.countActiveProjects(organizationId, tx);
    const check = checkEntitlementLimit('activeProjects', current, limits);

    if (!check.allowed) {
      logger.info(
        { organizationId, current, limit: check.limit },
        'Project creation blocked: activeProjects limit exceeded',
      );
      throw new EntitlementError({
        message: check.message,
        entitlementCode: 'LIMIT_EXCEEDED',
        dimension: 'activeProjects',
        current: check.current,
        limit: check.limit,
      });
    }

    logger.debug({ organizationId, current, limit: check.limit }, 'Project creation admitted by entitlement check');
  }

  /**
   * Asserts that the organization may create or accept an organization invitation.
   * Checks subscription state and teamMembers limit (D-04).
   *
   * MUST be called inside the same PostgreSQL transaction as the invitation or
   * membership write to prevent race conditions and pending-seat overbooking.
   */
  async assertCanInviteMember(organizationId: string, tx: any): Promise<void> {
    await this.assertCanUseMemberSeat(organizationId, tx);
  }

  async assertCanAcceptInvitation(
    organizationId: string,
    invitationId: string,
    tx: any,
  ): Promise<void> {
    await this.assertCanUseMemberSeat(organizationId, tx, invitationId);
  }

  private async assertCanUseMemberSeat(
    organizationId: string,
    tx: any,
    excludedInvitationId?: string,
  ): Promise<void> {
    await this.lockOrganizationUsage(organizationId, tx);
    const { limits, state } = await this.resolveEffectiveLimits(organizationId, tx);

    if (!limits) {
      logger.warn({ organizationId, state }, 'Member add blocked: no active subscription or trial');
      throw new EntitlementError({
        message: 'No active subscription or trial. Start a trial or subscribe to add team members.',
        entitlementCode: 'NO_ENTITLEMENT',
      });
    }

    // Restricted-state gate (D-09): member:invite is blocked post-grace
    if (state === 'RESTRICTED' || state === 'UNPAID') {
      throw new EntitlementError({
        message: "Inviting new team members is not available while your subscription is restricted. Update your payment method to restore access.",
        entitlementCode: 'ACCESS_RESTRICTED',
      });
    }

    // Pending invitations reserve seats; acceptance converts its own reservation.
    const activeMembers = await this.countActiveOrgMembers(organizationId, tx);
    const pendingInvitations = await this.countPendingInvitations(
      organizationId,
      tx,
      excludedInvitationId,
    );
    const current = activeMembers + pendingInvitations;
    const check = checkEntitlementLimit('teamMembers', current, limits);

    if (!check.allowed) {
      logger.info(
        { organizationId, current, limit: check.limit },
        'Organization invitation blocked: teamMembers limit exceeded',
      );
      throw new EntitlementError({
        message: check.message,
        entitlementCode: 'LIMIT_EXCEEDED',
        dimension: 'teamMembers',
        current: check.current,
        limit: check.limit,
      });
    }

    logger.debug({ organizationId, current, limit: check.limit }, 'Organization seat admitted by entitlement check');
  }
}

export const entitlementService = new EntitlementService();
