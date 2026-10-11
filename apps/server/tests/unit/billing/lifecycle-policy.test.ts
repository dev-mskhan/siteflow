import { describe, expect, it } from 'vitest';
import {
  GRACE_PERIOD_DAYS,
  computeGraceExpiresAt,
  computeGraceReminderSchedule,
  isActionAllowed,
  resolveAccessState,
  resolvePaymentRecovery,
  resolvePeriodEndAccess,
} from '../../../src/modules/billing/lifecycle.policy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_START = new Date('2026-03-01T12:00:00.000Z');

describe('grace reminder schedule', () => {
  it('places reminders on Day 1, Day 3, and Day 6 of grace', () => {
    const schedule = computeGraceReminderSchedule(GRACE_START);
    expect(schedule.map((s) => s.reminderKey)).toEqual([
      'grace_day_1',
      'grace_day_3',
      'grace_day_6',
    ]);
    expect(schedule.map((s) => s.dueAt.getTime() - GRACE_START.getTime())).toEqual([
      1 * DAY_MS,
      3 * DAY_MS,
      6 * DAY_MS,
    ]);
  });

  it('is deterministic for the same grace start', () => {
    expect(computeGraceReminderSchedule(GRACE_START)).toEqual(
      computeGraceReminderSchedule(new Date(GRACE_START)),
    );
  });

  it('does not mutate the grace start timestamp', () => {
    const start = new Date(GRACE_START);
    computeGraceReminderSchedule(start);
    expect(start.getTime()).toBe(GRACE_START.getTime());
  });
});

describe('grace expiry', () => {
  it('expires exactly seven days after grace start', () => {
    expect(GRACE_PERIOD_DAYS).toBe(7);
    expect(computeGraceExpiresAt(GRACE_START).getTime() - GRACE_START.getTime()).toBe(7 * DAY_MS);
  });
});

describe('resolveAccessState', () => {
  it('keeps past_due in GRACE before expiry', () => {
    const now = new Date(GRACE_START.getTime() + 6 * DAY_MS);
    expect(
      resolveAccessState({ status: 'PAST_DUE', graceStartedAt: GRACE_START, now }),
    ).toBe('GRACE');
  });

  it('restricts past_due at and after the 7-day boundary', () => {
    const atExpiry = new Date(GRACE_START.getTime() + 7 * DAY_MS);
    expect(
      resolveAccessState({ status: 'PAST_DUE', graceStartedAt: GRACE_START, now: atExpiry }),
    ).toBe('RESTRICTED');
  });

  it('restricts past_due without a recorded grace start', () => {
    expect(
      resolveAccessState({ status: 'PAST_DUE', graceStartedAt: null, now: GRACE_START }),
    ).toBe('RESTRICTED');
  });

  it('maps active, trialing, and unpaid states', () => {
    const now = GRACE_START;
    expect(resolveAccessState({ status: 'ACTIVE', graceStartedAt: null, now })).toBe('ACTIVE');
    expect(resolveAccessState({ status: 'TRIALING', graceStartedAt: null, now })).toBe('TRIAL');
    expect(resolveAccessState({ status: 'UNPAID', graceStartedAt: null, now })).toBe('RESTRICTED');
  });
});

describe('payment recovery', () => {
  it('returns to ACTIVE and cancels remaining reminders when recovering from grace', () => {
    expect(resolvePaymentRecovery('GRACE')).toEqual({
      nextStatus: 'ACTIVE',
      cancelRemainingGraceReminders: true,
    });
  });

  it('returns to ACTIVE from restricted and cancels reminders', () => {
    expect(resolvePaymentRecovery('RESTRICTED').cancelRemainingGraceReminders).toBe(true);
  });

  it('does not cancel anything when already active', () => {
    expect(resolvePaymentRecovery('ACTIVE')).toEqual({
      nextStatus: 'ACTIVE',
      cancelRemainingGraceReminders: false,
    });
  });
});

describe('access matrix (D-09)', () => {
  const allowedWhenRestricted = [
    'login',
    'view_settings',
    'update_payment_method',
    'view_billing_history',
    'read_project_data',
    'export_data',
  ] as const;
  const blockedWhenRestricted = [
    'create_project',
    'modify_project',
    'invite_members',
    'api_access',
  ] as const;

  it.each(allowedWhenRestricted)('allows %s when restricted', (action) => {
    expect(isActionAllowed('RESTRICTED', action)).toBe(true);
  });

  it.each(blockedWhenRestricted)('blocks %s when restricted', (action) => {
    expect(isActionAllowed('RESTRICTED', action)).toBe(false);
  });

  it.each([...allowedWhenRestricted, ...blockedWhenRestricted])(
    'allows %s during grace and active',
    (action) => {
      expect(isActionAllowed('GRACE', action)).toBe(true);
      expect(isActionAllowed('ACTIVE', action)).toBe(true);
    },
  );
});

describe('period-end cancellation', () => {
  const periodEnd = new Date('2026-04-01T00:00:00.000Z');

  it('keeps access until current_period_end when canceled at period end', () => {
    expect(
      resolvePeriodEndAccess({
        canceledAtPeriodEnd: true,
        currentPeriodEnd: periodEnd,
        now: new Date(periodEnd.getTime() - 1),
      }),
    ).toBe('ACTIVE');
  });

  it('ends access at current_period_end without touching data', () => {
    expect(
      resolvePeriodEndAccess({
        canceledAtPeriodEnd: true,
        currentPeriodEnd: periodEnd,
        now: periodEnd,
      }),
    ).toBe('CANCELED_ACCESS_ENDED');
  });

  it('keeps active subscriptions active regardless of period end', () => {
    expect(
      resolvePeriodEndAccess({
        canceledAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
        now: new Date(periodEnd.getTime() + DAY_MS),
      }),
    ).toBe('ACTIVE');
  });
});
