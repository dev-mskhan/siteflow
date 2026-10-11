// apps/server/tests/unit/billing/entitlement-policy.test.ts
// Phase 10 — Plan 11: Deterministic pure policy tests for entitlement decisions
// Covers all approved cases per 10-POLICY-DECISIONS.md (D-01, D-03, D-04, D-08, D-09)

import { describe, it, expect } from 'vitest';
import { APPROVED_LIMITS } from '@siteflow/shared';
import {
  checkEntitlementLimit,
  checkRestrictedStateAccess,
  resolveEntitlementState,
  isWithinGracePeriod,
  isTrialExpired,
} from '../../../src/modules/billing/entitlement.policy.js';

// ── Test 1: checkEntitlementLimit — approved limit boundary ──────────────────

describe('checkEntitlementLimit — approved limit boundary decisions', () => {
  it('allows operation when current usage is below the limit', () => {
    const result = checkEntitlementLimit('activeProjects', 2, APPROVED_LIMITS.starter);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ALLOWED');
    expect(result.current).toBe(2);
    expect(result.limit).toBe(3); // Starter: 3 projects
  });

  it('allows operation when usage is zero', () => {
    const result = checkEntitlementLimit('activeProjects', 0, APPROVED_LIMITS.professional);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ALLOWED');
  });

  it('blocks operation at exactly the approved limit (hard block — D-04)', () => {
    const result = checkEntitlementLimit('activeProjects', 3, APPROVED_LIMITS.starter);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('LIMIT_EXCEEDED');
    expect(result.current).toBe(3);
    expect(result.limit).toBe(3);
    expect(result.message).toMatch(/limit/i);
    expect(result.message).toMatch(/upgrade/i);
  });

  it('blocks operation when usage exceeds the limit', () => {
    const result = checkEntitlementLimit('activeProjects', 10, APPROVED_LIMITS.starter);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('LIMIT_EXCEEDED');
  });

  it('enforces Starter teamMembers limit of 10 (D-03)', () => {
    const atLimit = checkEntitlementLimit('teamMembers', 10, APPROVED_LIMITS.starter);
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.limit).toBe(10);

    const belowLimit = checkEntitlementLimit('teamMembers', 9, APPROVED_LIMITS.starter);
    expect(belowLimit.allowed).toBe(true);
  });

  it('enforces Professional teamMembers limit of 50 (D-03)', () => {
    const atLimit = checkEntitlementLimit('teamMembers', 50, APPROVED_LIMITS.professional);
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.limit).toBe(50);
  });

  it('enforces Enterprise activeProjects limit of 100 (D-03)', () => {
    const atLimit = checkEntitlementLimit('activeProjects', 100, APPROVED_LIMITS.enterprise);
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.limit).toBe(100);

    const belowLimit = checkEntitlementLimit('activeProjects', 99, APPROVED_LIMITS.enterprise);
    expect(belowLimit.allowed).toBe(true);
  });

  it('uses exact approved limits from APPROVED_LIMITS catalog — no inferred values', () => {
    // Starter limits from 10-POLICY-DECISIONS.md
    expect(APPROVED_LIMITS.starter.activeProjects).toBe(3);
    expect(APPROVED_LIMITS.starter.teamMembers).toBe(10);
    expect(APPROVED_LIMITS.starter.storageGb).toBe(50);
    expect(APPROVED_LIMITS.starter.apiCallsMonthly).toBe(5000);

    // Professional limits
    expect(APPROVED_LIMITS.professional.activeProjects).toBe(15);
    expect(APPROVED_LIMITS.professional.teamMembers).toBe(50);
    expect(APPROVED_LIMITS.professional.storageGb).toBe(250);
    expect(APPROVED_LIMITS.professional.apiCallsMonthly).toBe(25000);

    // Enterprise limits
    expect(APPROVED_LIMITS.enterprise.activeProjects).toBe(100);
    expect(APPROVED_LIMITS.enterprise.teamMembers).toBe(500);
    expect(APPROVED_LIMITS.enterprise.storageGb).toBe(1000);
    expect(APPROVED_LIMITS.enterprise.apiCallsMonthly).toBe(100000);
  });
});

// ── Test 2: checkRestrictedStateAccess — D-09 restricted matrix ──────────────

describe('checkRestrictedStateAccess — D-09 restricted-access matrix', () => {
  it('blocks project creation in restricted state', () => {
    const result = checkRestrictedStateAccess('project:create');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('ACCESS_RESTRICTED');
    expect(result.message).toMatch(/restricted/i);
  });

  it('blocks project update in restricted state', () => {
    const result = checkRestrictedStateAccess('project:update');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('ACCESS_RESTRICTED');
  });

  it('blocks member invite in restricted state', () => {
    const result = checkRestrictedStateAccess('member:invite');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('ACCESS_RESTRICTED');
  });

  it('blocks API access in restricted state', () => {
    const result = checkRestrictedStateAccess('api:access');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('ACCESS_RESTRICTED');
  });

  it('allows login/auth operation in restricted state (recovery path — D-09)', () => {
    const result = checkRestrictedStateAccess('auth:login');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ALLOWED');
  });

  it('allows billing:read (view invoices) in restricted state (D-09)', () => {
    const result = checkRestrictedStateAccess('billing:read');
    expect(result.allowed).toBe(true);
  });

  it('allows billing portal update in restricted state (D-09)', () => {
    const result = checkRestrictedStateAccess('billing:portal');
    expect(result.allowed).toBe(true);
  });

  it('allows project:read (existing data) in restricted state (D-09)', () => {
    const result = checkRestrictedStateAccess('project:read');
    expect(result.allowed).toBe(true);
  });
});

// ── Test 3: resolveEntitlementState — subscription state transitions ──────────

describe('resolveEntitlementState — subscription state and grace period', () => {
  it('allows limited operations for TRIALING state', () => {
    const result = resolveEntitlementState('TRIALING', false);
    expect(result.canPerformLimitedOps).toBe(true);
    expect(result.state).toBe('TRIALING');
  });

  it('allows limited operations for ACTIVE state', () => {
    const result = resolveEntitlementState('ACTIVE', false);
    expect(result.canPerformLimitedOps).toBe(true);
    expect(result.state).toBe('ACTIVE');
  });

  it('allows limited operations for PAST_DUE within grace period (D-08)', () => {
    const result = resolveEntitlementState('PAST_DUE', true);
    expect(result.canPerformLimitedOps).toBe(true);
    expect(result.state).toBe('PAST_DUE');
  });

  it('blocks limited operations for PAST_DUE after grace period expires (D-08)', () => {
    const result = resolveEntitlementState('PAST_DUE', false);
    expect(result.canPerformLimitedOps).toBe(false);
    expect(result.state).toBe('RESTRICTED');
  });

  it('blocks limited operations for RESTRICTED state', () => {
    const result = resolveEntitlementState('RESTRICTED', false);
    expect(result.canPerformLimitedOps).toBe(false);
    expect(result.state).toBe('RESTRICTED');
  });

  it('blocks limited operations for UNPAID state', () => {
    const result = resolveEntitlementState('UNPAID', false);
    expect(result.canPerformLimitedOps).toBe(false);
    expect(result.state).toBe('RESTRICTED');
  });

  it('blocks limited operations for CANCELED state', () => {
    const result = resolveEntitlementState('CANCELED', false);
    expect(result.canPerformLimitedOps).toBe(false);
    expect(result.state).toBe('CANCELED');
  });

  it('preserves limited operations through the paid period after cancellation (D-07)', () => {
    const result = resolveEntitlementState('CANCELED', false, true);
    expect(result.canPerformLimitedOps).toBe(true);
    expect(result.state).toBe('CANCELED');
  });

  it('blocks limited operations for NO_SUBSCRIPTION state', () => {
    const result = resolveEntitlementState('NO_SUBSCRIPTION', false);
    expect(result.canPerformLimitedOps).toBe(false);
    expect(result.state).toBe('NO_SUBSCRIPTION');
  });
});

// ── Test 4: isWithinGracePeriod — 7-day grace window (D-08) ──────────────────

describe('isWithinGracePeriod — 7-day grace window', () => {
  it('returns true when grace started just now', () => {
    const graceStart = new Date();
    expect(isWithinGracePeriod(graceStart)).toBe(true);
  });

  it('returns true when 3 days into the 7-day grace window', () => {
    const graceStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(isWithinGracePeriod(graceStart)).toBe(true);
  });

  it('returns false when 7 days have elapsed (grace expired)', () => {
    const graceStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1);
    expect(isWithinGracePeriod(graceStart)).toBe(false);
  });

  it('returns false for null graceStartsAt (not in grace period)', () => {
    expect(isWithinGracePeriod(null)).toBe(false);
    expect(isWithinGracePeriod(undefined)).toBe(false);
  });
});

// ── Test 5: isTrialExpired — trial expiry check (D-01) ───────────────────────

describe('isTrialExpired — 14-day trial expiry (D-01)', () => {
  it('returns false for a trial that has not yet expired', () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
    expect(isTrialExpired(expiresAt)).toBe(false);
  });

  it('returns true for a trial that has expired', () => {
    const expiresAt = new Date(Date.now() - 1); // 1 ms in the past
    expect(isTrialExpired(expiresAt)).toBe(true);
  });

  it('returns true exactly at expiry time', () => {
    const expiresAt = new Date(Date.now() - 0);
    expect(isTrialExpired(expiresAt)).toBe(true);
  });
});
