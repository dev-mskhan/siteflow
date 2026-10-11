import { saasWebhookInbox } from '@siteflow/database/schema';
import type Stripe from 'stripe';
import { sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';

export const WEBHOOK_INBOX_BATCH_SIZE = 50;
export const WEBHOOK_INBOX_MAX_ATTEMPTS = 8;
export const WEBHOOK_INBOX_LEASE_SECONDS = 600;

export interface ClaimedStripeWebhookEvent {
  id: string;
  providerEventId: string;
  eventType: string;
  eventCreatedAt: Date | string;
  liveMode: boolean;
  objectType: string | null;
  objectId: string | null;
  status: string;
  attemptCount: number;
}

const EXPECTED_OBJECT_TYPE: Record<string, 'subscription' | 'invoice'> = {
  'customer.subscription.created': 'subscription',
  'customer.subscription.updated': 'subscription',
  'customer.subscription.deleted': 'subscription',
  'invoice.paid': 'invoice',
  'invoice.payment_failed': 'invoice',
};

export function getSupportedStripeObjectType(
  eventType: string,
): 'subscription' | 'invoice' | undefined {
  return EXPECTED_OBJECT_TYPE[eventType];
}

/**
 * Inserts only a bounded provider reference. Raw webhook bodies, metadata, and
 * organization identifiers are intentionally excluded from the inbound ledger.
 */
export async function recordVerifiedStripeEvent(
  event: Stripe.Event,
): Promise<'inserted' | 'duplicate'> {
  const eventObject = event.data.object;
  const objectType =
    eventObject &&
    typeof eventObject === 'object' &&
    'object' in eventObject &&
    typeof eventObject.object === 'string'
      ? eventObject.object
      : null;
  const objectId =
    eventObject &&
    typeof eventObject === 'object' &&
    'id' in eventObject &&
    typeof eventObject.id === 'string'
      ? eventObject.id
      : null;

  const inserted = await getDb()
    .insert(saasWebhookInbox)
    .values({
      id: crypto.randomUUID(),
      provider: 'stripe',
      providerEventId: event.id,
      eventType: event.type,
      eventCreatedAt: new Date(event.created * 1000),
      liveMode: event.livemode,
      objectType,
      objectId,
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({
      target: [saasWebhookInbox.provider, saasWebhookInbox.providerEventId],
    })
    .returning({ id: saasWebhookInbox.id });

  return inserted.length === 0 ? 'duplicate' : 'inserted';
}

/**
 * Claims due work with one atomic PostgreSQL statement. Row locks and
 * SKIP LOCKED prevent competing workers from claiming the same event. PROCESSING
 * rows carry a durable lease in next_attempt_at and become claimable after a
 * worker crash.
 */
export async function claimDueStripeWebhookEvents(
  batchSize = WEBHOOK_INBOX_BATCH_SIZE,
): Promise<ClaimedStripeWebhookEvent[]> {
  return getDb().transaction(async (tx) => {
    const claimed = await tx.execute(sql`
      WITH candidates AS (
        SELECT id
        FROM app.saas_webhook_inbox
        WHERE (
          (status IN ('PENDING', 'RETRY') AND next_attempt_at <= now())
          OR (status = 'PROCESSING' AND next_attempt_at <= now())
        )
        ORDER BY next_attempt_at, received_at, id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE app.saas_webhook_inbox AS inbox
      SET status = 'PROCESSING',
          attempt_count = inbox.attempt_count + 1,
          last_attempt_at = now(),
          next_attempt_at = now() + (${WEBHOOK_INBOX_LEASE_SECONDS} * interval '1 second'),
          updated_at = now()
      FROM candidates
      WHERE inbox.id = candidates.id
      RETURNING inbox.id,
        inbox.provider_event_id AS "providerEventId",
        inbox.event_type AS "eventType",
        inbox.event_created_at AS "eventCreatedAt",
        inbox.live_mode AS "liveMode",
        inbox.object_type AS "objectType",
        inbox.object_id AS "objectId",
        inbox.status,
        inbox.attempt_count AS "attemptCount"
    `);
    return claimed as unknown as ClaimedStripeWebhookEvent[];
  });
}

export async function markStripeWebhookProcessed(eventId: string): Promise<void> {
  await getDb().execute(sql`
    UPDATE app.saas_webhook_inbox
    SET status = 'PROCESSED',
        processed_at = now(),
        last_error_code = NULL,
        updated_at = now()
    WHERE id = ${eventId} AND status = 'PROCESSING'
  `);
}

export async function markStripeWebhookQuarantined(
  eventId: string,
  errorCode: string,
): Promise<void> {
  await getDb().execute(sql`
    UPDATE app.saas_webhook_inbox
    SET status = 'QUARANTINED',
        last_error_code = ${errorCode.slice(0, 128)},
        updated_at = now()
    WHERE id = ${eventId} AND status = 'PROCESSING'
  `);
}

export async function scheduleStripeWebhookRetry(params: {
  eventId: string;
  attemptCount: number;
  errorCode: string;
}): Promise<void> {
  const terminal = params.attemptCount >= WEBHOOK_INBOX_MAX_ATTEMPTS;
  const delaySeconds = Math.min(30 * 2 ** Math.max(0, params.attemptCount - 1), 3600);
  await getDb().execute(sql`
    UPDATE app.saas_webhook_inbox
    SET status = ${terminal ? 'FAILED' : 'RETRY'},
        next_attempt_at = CASE
          WHEN ${terminal} THEN next_attempt_at
          ELSE now() + (${delaySeconds} * interval '1 second')
        END,
        last_error_code = ${params.errorCode.slice(0, 128)},
        updated_at = now()
    WHERE id = ${params.eventId} AND status = 'PROCESSING'
  `);
}
