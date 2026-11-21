// apps/server/src/modules/billing/entitlement.service.ts
// Phase 10 — Plan 11: Transactional entitlement admission
// Enforces approved limits atomically in PostgreSQL at consuming operation boundaries.

import { count, eq, and, notInArray, sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  projects,
  organizationMemberships,
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
  override readonly code: 'LIMIT_EXCEEDED' | 'ACCESS_RESTRICTED' | 'NO_ENTITLEMENT' | 'TRIAL_EXPIRED';
  public readonly entitlementCode: 'LIMIT_EXCEEDED' | 'ACCESS_RESTRICTED' | 'NO_ENTITLEMENT' | 'TRIAL_EXPIRED';
  public readonly dimension?: string;
  public readonly current?: number;
  public readonly limit?: number;
  public readonly metadata?: Record<string, any>;

  constructor(params: {
    message: string;
    entitlementCode: 'LIMIT_EXCEEDED' | 'ACCESS_RESTRICTED' | 'NO_ENTITLEMENT' | 'TRIAL_EXPIRED';
    dimension?: string;
    current?: number;
    limit?: number;
    metadata?: Record<string, any>;
  }) {
    super(params.message);
    this.name = 'EntitlementError';
    this.code = params.entitlementCode;
    this.entitlementCode = params.entitlementCode;
    this.dimension = params.dimension;
    this.current = params.current;
    this.limit = params.limit;
    this.metadata = params.metadata;
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
    graceRemaining?: number;
    isGracePeriod?: boolean;
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

    if (trial[0] && trial[0].status === 'ACTIVE') {
      const now = new Date();
      
      if (trial[0].expiresAt > now) {
        // Trial is still active — return trial limits, not Professional
        return {
          limits: APPROVED_LIMITS.trial,
          state: 'TRIALING' as SubscriptionState,
          graceStartsAt: null,
        };
      }
      
      if (trial[0].expiresAt <= now) {
        // Trial expired - check grace period (3 days)
        const GRACE_PERIOD_DAYS = 3;
        const gracePeriodEnd = new Date(
          trial[0].expiresAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
        );
        
        if (now < gracePeriodEnd) {
          // Still in grace period
          const graceRemaining = Math.ceil(
            (gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          logger.info(
            { organizationId, graceRemaining, gracePeriodEnd },
            'Organization in trial grace period'
          );
          
          return {
            limits: APPROVED_LIMITS.trial,
            state: 'GRACE_PERIOD' as any,
            graceStartsAt: trial[0].expiresAt,
            graceRemaining,
            isGracePeriod: true,
          };
        }
        
        // Grace period ended
        logger.warn(
          { organizationId, trialEndedAt: trial[0].expiresAt },
          'Trial grace period ended'
        );
        
        return { limits: null, state: 'EXPIRED' as any, graceStartsAt: null };
      }
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
          eq(organizationMemberships.status, 'ACTIVE'),
        ),
      );
    return Number(result[0]?.cnt ?? 0);
  }

  async lockOrganizationUsage(organizationId: string, tx: any): Promise<void> {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`siteflow-entitlement:${organizationId}`}, 0))`,
    );
  }

  // ── Feature gates ─────────────────────────────────────────────────────────

  /**
   * Asserts that the organization's current plan includes the specified feature.
   * Throws FEATURE_RESTRICTED (HTTP 403) if the feature is disabled for the plan.
   * Must be called inside a PostgreSQL transaction when combined with other gates.
   */
  async assertPlanFeature(
    organizationId: string,
    feature: keyof PlanLimits['features'],
    tx?: any,
  ): Promise<void> {
    const db = tx ?? getDb();
    const { limits } = await this.resolveEffectiveLimits(organizationId, db);

    if (!limits) {
      logger.warn({ organizationId, feature }, 'Feature access blocked: no active subscription or trial');
      throw new EntitlementError({
        message: 'No active subscription or trial. Start a trial or subscribe to access this feature.',
        entitlementCode: 'NO_ENTITLEMENT',
        metadata: {
          feature,
          startTrialUrl: `/organizations/${organizationId}/billing/trial`,
        },
      });
    }

    if (!limits.features[feature]) {
      logger.info(
        { organizationId, feature, plan: limits },
        'Feature access blocked: not included in current plan',
      );
      throw new EntitlementError({
        message: `This feature is not available on your current plan. Upgrade to access ${feature}.`,
        entitlementCode: 'FEATURE_RESTRICTED',
        metadata: {
          feature,
          upgradeUrl: `/organizations/${organizationId}/billing/checkout?planId=professional`,
        },
      });
    }

    logger.debug({ organizationId, feature }, 'Feature access granted');
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
   * Asserts that existing projects may be modified. Restricted post-grace states
   * block writes per D-09; reads and exports are never gated here.
   */
  async assertCanModifyProject(organizationId: string, tx: any): Promise<void> {
    await this.lockOrganizationUsage(organizationId, tx);
    const { limits, state } = await this.resolveEffectiveLimits(organizationId, tx);

    const stateCheck = checkRestrictedStateAccess('project:update');
    if (!stateCheck.allowed && (state === 'RESTRICTED' || state === 'UNPAID')) {
      throw new EntitlementError({
        message: stateCheck.message,
        entitlementCode: 'ACCESS_RESTRICTED',
      });
    }

    if (!limits) {
      throw new EntitlementError({
        message: 'No active subscription or trial. Start a trial or subscribe to modify projects.',
        entitlementCode: 'NO_ENTITLEMENT',
      });
    }
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
    tx: any,
  ): Promise<void> {
    await this.assertCanUseMemberSeat(organizationId, tx);
  }

  private async assertCanUseMemberSeat(organizationId: string, tx: any): Promise<void> {
    await this.lockOrganizationUsage(organizationId, tx);
    const { limits, state } = await this.resolveEffectiveLimits(organizationId, tx);

    if (!limits) {
      if ((state as string) === 'EXPIRED') {
        logger.warn(
          { organizationId },
          'Member invite blocked: trial expired',
        );
        throw new EntitlementError({
          message: 'Your trial has ended. Upgrade to Professional to continue inviting team members.',
          entitlementCode: 'TRIAL_EXPIRED',
          metadata: {
            upgradeUrl: `/organizations/${organizationId}/billing/checkout?planId=professional`,
          },
        });
      }

      logger.warn({ organizationId, state }, 'Member add blocked: no active subscription or trial');
      throw new EntitlementError({
        message: 'No active subscription or trial. Start a trial or subscribe to add team members.',
        entitlementCode: 'NO_ENTITLEMENT',
        metadata: {
          startTrialUrl: `/organizations/${organizationId}/billing/trial`,
        },
      });
    }

    // Grace period check - allow operation but log it
    if ((state as string) === 'GRACE_PERIOD') {
      logger.info(
        { organizationId },
        'Member invite during trial grace period - allowed',
      );
      return;
    }

    // Restricted-state gate (D-09): member:invite is blocked post-grace
    if (state === 'RESTRICTED' || state === 'UNPAID') {
      throw new EntitlementError({
        message: "Inviting new team members is not available while your subscription is restricted. Update your payment method to restore access.",
        entitlementCode: 'ACCESS_RESTRICTED',
      });
    }

    const activeMembers = await this.countActiveOrgMembers(organizationId, tx);
    const check = checkEntitlementLimit('teamMembers', activeMembers, limits);

    if (!check.allowed) {
      logger.info(
        { organizationId, current: activeMembers, limit: check.limit },
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

    logger.debug({ organizationId, current: activeMembers, limit: check.limit }, 'Organization seat admitted by entitlement check');
  }
}

export const entitlementService = new EntitlementService();
