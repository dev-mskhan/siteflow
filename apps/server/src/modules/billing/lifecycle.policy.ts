// apps/server/src/modules/billing/lifecycle.policy.ts
// Phase 10 (Plan 10-09 Task 3): pure, deterministic lifecycle transitions.
// Based on 10-POLICY-DECISIONS.md: D-07 (period-end mapping), D-08 (grace/reminders), D-09 (restricted matrix).

const DAY_MS = 24 * 60 * 60 * 1000;

export const GRACE_PERIOD_DAYS = 7;

export const GRACE_REMINDER_DAYS = [1, 3, 6] as const;
export type GraceReminderDay = (typeof GRACE_REMINDER_DAYS)[number];

export type LifecycleAccessState = 'TRIAL' | 'ACTIVE' | 'GRACE' | 'RESTRICTED';

export interface GraceReminderOccurrence {
  reminderKey: `grace_day_${GraceReminderDay}`;
  day: GraceReminderDay;
  dueAt: Date;
}

export function computeGraceExpiresAt(graceStartedAt: Date): Date {
  return new Date(graceStartedAt.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
}

/** Day 1, Day 3, and Day 6 occurrences measured from the recorded grace start. */
export function computeGraceReminderSchedule(graceStartedAt: Date): GraceReminderOccurrence[] {
  return GRACE_REMINDER_DAYS.map((day) => ({
    reminderKey: `grace_day_${day}` as const,
    day,
    dueAt: new Date(graceStartedAt.getTime() + day * DAY_MS),
  }));
}

/**
 * Maps persisted subscription facts to the access state. A past_due subscription
 * with no recorded grace start cannot prove grace time remains, so it is restricted.
 */
export function resolveAccessState(input: {
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIAL_EXPIRED';
  graceStartedAt: Date | null;
  now: Date;
}): LifecycleAccessState {
  switch (input.status) {
    case 'TRIALING':
      return 'TRIAL';
    case 'ACTIVE':
      return 'ACTIVE';
    case 'PAST_DUE':
      if (!input.graceStartedAt) return 'RESTRICTED';
      return input.now.getTime() < computeGraceExpiresAt(input.graceStartedAt).getTime()
        ? 'GRACE'
        : 'RESTRICTED';
    default:
      return 'RESTRICTED';
  }
}

export interface PaymentRecoveryDecision {
  nextStatus: 'ACTIVE';
  cancelRemainingGraceReminders: boolean;
}

/** A successful payment (Checkout or Portal) returns any grace/restricted state to active. */
export function resolvePaymentRecovery(priorState: LifecycleAccessState): PaymentRecoveryDecision {
  return {
    nextStatus: 'ACTIVE',
    cancelRemainingGraceReminders: priorState === 'GRACE' || priorState === 'RESTRICTED',
  };
}

export const RESTRICTED_ACTIONS = [
  'login',
  'view_settings',
  'update_payment_method',
  'view_billing_history',
  'read_project_data',
  'export_data',
  'create_project',
  'modify_project',
  'invite_members',
  'api_access',
] as const;
export type AccessAction = (typeof RESTRICTED_ACTIONS)[number];

const BLOCKED_WHEN_RESTRICTED: ReadonlySet<AccessAction> = new Set<AccessAction>([
  'create_project',
  'modify_project',
  'invite_members',
  'api_access',
]);

/** D-09 matrix: only write/create and external-API operations are blocked after grace ends. */
export function isActionAllowed(state: LifecycleAccessState, action: AccessAction): boolean {
  if (state !== 'RESTRICTED') return true;
  return !BLOCKED_WHEN_RESTRICTED.has(action);
}

/**
 * Scheduled cancellation keeps paid access until current_period_end; the downgrade
 * tier applies at that same boundary. Customer data is never deleted by these transitions.
 */
export function resolvePeriodEndAccess(input: {
  canceledAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
  now: Date;
}): 'ACTIVE' | 'CANCELED_ACCESS_ENDED' {
  if (!input.canceledAtPeriodEnd) return 'ACTIVE';
  return input.now.getTime() < input.currentPeriodEnd.getTime() ? 'ACTIVE' : 'CANCELED_ACCESS_ENDED';
}
