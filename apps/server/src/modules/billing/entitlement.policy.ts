// apps/server/src/modules/billing/entitlement.policy.ts
// Phase 10 — Plan 11: Pure approved entitlement and access decisions
// Based on 10-POLICY-DECISIONS.md: D-03, D-04, D-08, D-09

import type { PlanLimits } from '@siteflow/shared';

// ── Approved limit dimensions (D-03, D-04) ────────────────────────────────────

export type EntitlementDimension = 'activeProjects' | 'teamMembers' | 'storageGb' | 'apiCallsMonthly';

// ── Subscription states ───────────────────────────────────────────────────────

export type SubscriptionState =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'         // grace period — within 7 days of payment failure
  | 'RESTRICTED'       // post-grace: access restricted per D-09 matrix
  | 'CANCELED'
  | 'UNPAID'           // alias for RESTRICTED after grace exhausted
  | 'NO_SUBSCRIPTION'; // no trial, no subscription

// ── Entitlement check result ──────────────────────────────────────────────────

export interface EntitlementCheckResult {
  allowed: boolean;
  reason: 'ALLOWED' | 'LIMIT_EXCEEDED' | 'ACCESS_RESTRICTED' | 'NO_ENTITLEMENT';
  /** Human-readable message for API error responses */
  message: string;
  /** Current usage for the dimension */
  current?: number;
  /** Approved limit for the dimension */
  limit?: number;
}

// ── Restricted-access matrix (D-09) ──────────────────────────────────────────

/**
 * Operations that are BLOCKED in the RESTRICTED / UNPAID state (post-grace).
 * All other operations remain accessible (login, settings read, portal, invoice history,
 * existing project data read/export) per the approved matrix.
 */
const RESTRICTED_STATE_BLOCKED_OPERATIONS = new Set<string>([
  'project:create',
  'project:update',
  'member:invite',
  'api:access',
]);

/**
 * Checks whether an operation is allowed in the RESTRICTED (post-grace) state.
 * Essential account/billing recovery and data-read paths remain accessible per D-09.
 */
export function checkRestrictedStateAccess(operation: string): EntitlementCheckResult {
  if (RESTRICTED_STATE_BLOCKED_OPERATIONS.has(operation)) {
    return {
      allowed: false,
      reason: 'ACCESS_RESTRICTED',
      message: `Operation '${operation}' is not available while the subscription is restricted. Update your payment method to restore access.`,
    };
  }
  return {
    allowed: true,
    reason: 'ALLOWED',
    message: 'Operation allowed during restricted state',
  };
}

// ── Limit enforcement (D-03, D-04) ───────────────────────────────────────────

/**
 * Pure entitlement check: determines whether an organization may perform a
 * limited operation given their current usage and approved limit.
 *
 * Hard block at the approved limit boundary (D-04):
 *   current >= limit → 403 LIMIT_EXCEEDED with upgrade prompt
 *
 * This function never touches the database. The caller must supply accurate
 * tenant-scoped usage counts from PostgreSQL (never from client input or cache).
 */
export function checkEntitlementLimit(
  dimension: EntitlementDimension,
  current: number,
  limits: PlanLimits,
): EntitlementCheckResult {
  const limit = limits[dimension];

  if (current >= limit) {
    return {
      allowed: false,
      reason: 'LIMIT_EXCEEDED',
      message: `Your organization has reached the ${dimensionLabel(dimension)} limit (${limit}). Upgrade your plan to continue.`,
      current,
      limit,
    };
  }

  return {
    allowed: true,
    reason: 'ALLOWED',
    message: 'Within approved entitlement limit',
    current,
    limit,
  };
}

// ── Subscription state guard ──────────────────────────────────────────────────

/**
 * Returns the effective entitlement state given the current subscription status.
 *
 * Rules (D-01, D-02, D-07, D-08, D-09):
 * - TRIALING: Professional-tier limits apply; no paid subscription charge
 * - ACTIVE / PAST_DUE: limits from current subscription apply
 * - RESTRICTED / UNPAID: only recovery operations allowed
 * - CANCELED: entitlements remain through the paid period, then end (D-07)
 * - NO_SUBSCRIPTION: no entitlements
 *
 * Trial expiry does NOT trigger an automatic charge (D-01, D-02).
 */
export function resolveEntitlementState(
  subscriptionStatus: SubscriptionState,
  isWithinGracePeriod: boolean,
  isWithinCanceledPeriod = false,
): {
  canPerformLimitedOps: boolean;
  state: SubscriptionState;
  reason: string;
} {
  switch (subscriptionStatus) {
    case 'TRIALING':
    case 'ACTIVE':
      return { canPerformLimitedOps: true, state: subscriptionStatus, reason: 'Subscription active' };

    case 'PAST_DUE':
      if (isWithinGracePeriod) {
        // Within 7-day grace: all operations still allowed per D-09 matrix
        return { canPerformLimitedOps: true, state: 'PAST_DUE', reason: 'Within grace period' };
      }
      // Past the 7-day window without recovery → restricted
      return { canPerformLimitedOps: false, state: 'RESTRICTED', reason: 'Grace period expired' };

    case 'RESTRICTED':
    case 'UNPAID':
      return { canPerformLimitedOps: false, state: 'RESTRICTED', reason: 'Subscription restricted post-grace' };

    case 'CANCELED':
      if (isWithinCanceledPeriod) {
        return { canPerformLimitedOps: true, state: 'CANCELED', reason: 'Paid period remains active' };
      }
      return { canPerformLimitedOps: false, state: 'CANCELED', reason: 'Subscription canceled' };

    case 'NO_SUBSCRIPTION':
      return { canPerformLimitedOps: false, state: 'NO_SUBSCRIPTION', reason: 'No active subscription or trial' };

    default:
      return { canPerformLimitedOps: false, state: 'NO_SUBSCRIPTION', reason: 'Unknown subscription state' };
  }
}

// ── Grace period check (D-08) ─────────────────────────────────────────────────

/**
 * Determines whether an organization is still within the approved 7-day grace period.
 * Grace starts at graceStartsAt and lasts exactly 7 days (D-08).
 */
export function isWithinGracePeriod(graceStartsAt: Date | null | undefined): boolean {
  if (!graceStartsAt) return false;
  const graceDurationMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() < graceStartsAt.getTime() + graceDurationMs;
}

// ── Trial expiry check (D-01) ─────────────────────────────────────────────────

/**
 * Returns true if the trial has expired. Expired trials cannot be reactivated (D-01).
 */
export function isTrialExpired(expiresAt: Date): boolean {
  return Date.now() >= expiresAt.getTime();
}

// ── Utility ───────────────────────────────────────────────────────────────────

function dimensionLabel(dimension: EntitlementDimension): string {
  const labels: Record<EntitlementDimension, string> = {
    activeProjects: 'active projects',
    teamMembers: 'team members',
    storageGb: 'storage (GB)',
    apiCallsMonthly: 'API calls per month',
  };
  return labels[dimension];
}
