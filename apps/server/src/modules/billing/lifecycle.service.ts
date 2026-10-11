// apps/server/src/modules/billing/lifecycle.service.ts
// Phase 10 (Plan 10-09 Task 3): durable grace-reminder dispatch.
// Transport runs outside DB transactions; SENT is recorded only after an affirmative transport result.

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '@siteflow/observability/server';
import { serverEnv } from '../../config/env.js';
import {
  claimDueReminderDeliveries,
  countReminderDeliveriesByStatus,
  countRetryingReminderDeliveries,
  getCurrentSubscriptionSnapshot,
  listBillingAdminEmails,
  markReminderFailed,
  markReminderRetry,
  markReminderSent,
  scheduleReminderDelivery,
  type ClaimedReminderDelivery,
} from './reminder-delivery.repository.js';
import {
  computeGraceReminderSchedule,
  resolveAccessState,
} from './lifecycle.policy.js';
import { ReminderTransportError, sendGraceReminder } from './reminder-delivery.transport.js';

const logger = createLogger({ name: 'billing-lifecycle' });
const tracer = trace.getTracer('billing-lifecycle');

export const MAX_REMINDER_ATTEMPTS = 5;
const RETRY_BASE_SECONDS = 60;
const RETRY_MAX_SECONDS = 3600;

export function computeRetryDelaySeconds(attemptCount: number): number {
  return Math.min(RETRY_MAX_SECONDS, RETRY_BASE_SECONDS * 2 ** Math.max(0, attemptCount - 1));
}

function reminderDayFromKey(reminderKey: string): number {
  const match = /^grace_day_(\d+)$/.exec(reminderKey);
  return match ? Number(match[1]) : 0;
}

/** Creates the Day 1/3/6 occurrences for the current past_due subscription. Idempotent. */
export async function ensureGraceReminderSchedule(organizationId: string): Promise<number> {
  const snapshot = await getCurrentSubscriptionSnapshot(organizationId);
  if (!snapshot || snapshot.status !== 'PAST_DUE' || !snapshot.graceStartsAt) return 0;

  let inserted = 0;
  for (const occurrence of computeGraceReminderSchedule(snapshot.graceStartsAt)) {
    const result = await scheduleReminderDelivery({
      organizationId,
      subscriptionId: snapshot.subscriptionId,
      reminderKey: occurrence.reminderKey,
      idempotencyKey: `${snapshot.subscriptionId}:${occurrence.reminderKey}`,
      dueAt: occurrence.dueAt,
    });
    if (result === 'inserted') inserted += 1;
  }
  return inserted;
}

function billingPortalUrl(organizationId: string): string {
  const base = serverEnv.FRONTEND_URL ?? 'http://localhost:5173';
  return `${base}/organizations/${organizationId}/billing`;
}

type DispatchOutcome = 'SENT' | 'RETRY' | 'FAILED';

async function dispatchOne(
  organizationId: string,
  delivery: ClaimedReminderDelivery,
): Promise<DispatchOutcome> {
  const snapshot = await getCurrentSubscriptionSnapshot(organizationId);
  const stillInGrace =
    snapshot !== null &&
    snapshot.graceStartsAt !== null &&
    resolveAccessState({
      status: snapshot.status as 'PAST_DUE',
      graceStartedAt: snapshot.graceStartsAt,
      now: new Date(),
    }) === 'GRACE' &&
    snapshot.subscriptionId === delivery.subscriptionId;

  if (!stillInGrace) {
    await markReminderFailed({ organizationId, deliveryId: delivery.id, errorCode: 'GRACE_NO_LONGER_ACTIVE' });
    return 'FAILED';
  }

  const recipients = await listBillingAdminEmails(organizationId);
  if (recipients.length === 0) {
    await markReminderFailed({ organizationId, deliveryId: delivery.id, errorCode: 'NO_BILLING_RECIPIENTS' });
    return 'FAILED';
  }

  try {
    await sendGraceReminder({
      recipients,
      planName: snapshot.planName ?? 'SiteFlow',
      graceDay: reminderDayFromKey(delivery.reminderKey),
      amountDueText:
        snapshot.amountDueCents !== null && snapshot.currency
          ? `${(snapshot.amountDueCents / 100).toFixed(2)} ${snapshot.currency.toUpperCase()}`
          : null,
      billingPortalUrl: billingPortalUrl(organizationId),
    });
  } catch (err) {
    const code = err instanceof ReminderTransportError ? err.code : 'TRANSPORT_SEND_FAILED';
    if (delivery.attemptCount >= MAX_REMINDER_ATTEMPTS) {
      await markReminderFailed({ organizationId, deliveryId: delivery.id, errorCode: code });
      return 'FAILED';
    }
    await markReminderRetry({
      organizationId,
      deliveryId: delivery.id,
      errorCode: code,
      delaySeconds: computeRetryDelaySeconds(delivery.attemptCount),
    });
    return 'RETRY';
  }

  await markReminderSent({ organizationId, deliveryId: delivery.id });
  return 'SENT';
}

/** Claims due reminders for one tenant and dispatches each. Returns outcome counts. */
export async function dispatchDueGraceReminders(organizationId: string): Promise<Record<DispatchOutcome, number>> {
  return tracer.startActiveSpan('billing.lifecycle.dispatch', async (span) => {
    const counts: Record<DispatchOutcome, number> = { SENT: 0, RETRY: 0, FAILED: 0 };
    try {
      await ensureGraceReminderSchedule(organizationId);
      const claimed = await claimDueReminderDeliveries({ organizationId });
      for (const delivery of claimed) {
        try {
          const outcome = await dispatchOne(organizationId, delivery);
          counts[outcome] += 1;
          logger.info({ organizationId, deliveryId: delivery.id, outcome }, 'grace reminder processed');
        } catch (err) {
          counts.RETRY += 1;
          logger.error({ organizationId, deliveryId: delivery.id, errorName: err instanceof Error ? err.name : 'unknown' }, 'grace reminder dispatch error');
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'reminder dispatch failed' });
        }
      }
      return counts;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'lifecycle dispatch failed' });
      logger.error({ organizationId, errorName: err instanceof Error ? err.name : 'unknown' }, 'lifecycle dispatch failed');
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function getReminderDeliveryStatus(organizationId: string) {
  const byStatus = await countReminderDeliveriesByStatus(organizationId);
  return {
    pending: byStatus.PENDING ?? 0,
    inProgress: byStatus.IN_PROGRESS ?? 0,
    sent: byStatus.SENT ?? 0,
    failed: byStatus.FAILED ?? 0,
    retrying: await countRetryingReminderDeliveries(organizationId),
  };
}
