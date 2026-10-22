import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../lib/queue/worker-factory.js';
import {
  WEBHOOK_INBOX_BATCH_SIZE,
  WEBHOOK_INBOX_MAX_ATTEMPTS,
  claimDueStripeWebhookEvents,
  markStripeWebhookProcessed,
  markStripeWebhookQuarantined,
  scheduleStripeWebhookRetry,
} from './webhook-inbox.repository.js';
import {
  getStripeWebhookReconciliationErrorCode,
  reconcileStripeWebhookEvent,
  StripeWebhookQuarantineError,
} from './provider-reconciler.js';

const logger = createLogger({ name: 'stripe-webhook-recovery-worker' });

import { STRIPE_WEBHOOK_RECOVERY_QUEUE } from './billing.jobs.js';
export { STRIPE_WEBHOOK_RECOVERY_QUEUE };
export const STRIPE_WEBHOOK_RECOVERY_CRON = '* * * * *';
export const STRIPE_WEBHOOK_RECOVERY_INTERVAL = '1 minute';
export const STRIPE_WEBHOOK_RECOVERY_SCHEDULE_ID =
  'siteflow-stripe-webhook-inbox-recovery-v1';
const MAX_SCAN_BATCHES_PER_RUN = 10;

async function processClaimedEvent(
  event: Awaited<ReturnType<typeof claimDueStripeWebhookEvents>>[number],
): Promise<void> {
  try {
    await reconcileStripeWebhookEvent(event);
    await markStripeWebhookProcessed(event.id);
    logger.info(
      { providerEventId: event.providerEventId, attemptCount: event.attemptCount },
      'Stripe webhook reconciled from current provider state',
    );
  } catch (error) {
    if (error instanceof StripeWebhookQuarantineError) {
      await markStripeWebhookQuarantined(event.id, error.code);
      logger.warn(
        { providerEventId: event.providerEventId, reason: error.code },
        'Stripe webhook quarantined because its persisted provider mapping or facts are invalid',
      );
      return;
    }

    const errorCode = getStripeWebhookReconciliationErrorCode(error);
    await scheduleStripeWebhookRetry({
      eventId: event.id,
      attemptCount: event.attemptCount,
      errorCode,
    });
    logger.warn(
      {
        providerEventId: event.providerEventId,
        attemptCount: event.attemptCount,
        retryLimit: WEBHOOK_INBOX_MAX_ATTEMPTS,
        errorCode,
      },
      'Stripe webhook reconciliation failed; durable retry state was recorded',
    );
  }
}

/**
 * The inbox is the recovery source of truth. A bounded number of indexed
 * batches is scanned per invocation, including immediately during startup.
 */
export async function recoverStripeWebhookInbox(): Promise<number> {
  let processedCount = 0;
  for (let batchNumber = 0; batchNumber < MAX_SCAN_BATCHES_PER_RUN; batchNumber += 1) {
    const events = await claimDueStripeWebhookEvents(WEBHOOK_INBOX_BATCH_SIZE);
    if (events.length === 0) break;
    await Promise.all(events.map(processClaimedEvent));
    processedCount += events.length;
    if (events.length < WEBHOOK_INBOX_BATCH_SIZE) break;
  }
  return processedCount;
}

export async function registerStripeWebhookWorker(boss: PgBoss): Promise<void> {
  await boss.createQueue(STRIPE_WEBHOOK_RECOVERY_QUEUE, {
    name: STRIPE_WEBHOOK_RECOVERY_QUEUE,
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
  });
  await registerWorker<Record<string, never>>(
    boss,
    {
      queue: STRIPE_WEBHOOK_RECOVERY_QUEUE,
      concurrency: 1,
      timeoutSecs: 720,
    },
    async () => {
      await recoverStripeWebhookInbox();
    },
  );

  // Startup recovery is intentionally independent of PgBoss enqueue/schedule
  // timing; committed acknowledged rows are rediscovered directly from SQL.
  const recovered = await recoverStripeWebhookInbox();
  logger.info({ recovered }, 'Completed immediate Stripe webhook inbox recovery scan');

  await boss.schedule(
    STRIPE_WEBHOOK_RECOVERY_QUEUE,
    STRIPE_WEBHOOK_RECOVERY_CRON,
    {},
    {
      singletonKey: STRIPE_WEBHOOK_RECOVERY_SCHEDULE_ID,
      retryLimit: 2,
      retryDelay: 30,
      retryBackoff: true,
    },
  );
  logger.info(
    {
      scheduleId: STRIPE_WEBHOOK_RECOVERY_SCHEDULE_ID,
      interval: STRIPE_WEBHOOK_RECOVERY_INTERVAL,
      queue: STRIPE_WEBHOOK_RECOVERY_QUEUE,
    },
    'Scheduled durable Stripe webhook inbox recovery',
  );
}
