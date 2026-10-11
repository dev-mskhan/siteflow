import { saasReminderDeliveries } from '@siteflow/database/schema';
import { sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';

export const REMINDER_DELIVERY_BATCH_SIZE = 25;
export const REMINDER_DELIVERY_LEASE_SECONDS = 300;

export interface ClaimedReminderDelivery {
  id: string;
  organizationId: string;
  subscriptionId: string;
  reminderKey: string;
  idempotencyKey: string;
  attemptCount: number;
}

export interface ScheduleReminderInput {
  organizationId: string;
  subscriptionId: string;
  reminderKey: string;
  idempotencyKey: string;
  dueAt: Date;
}

/**
 * Inserts one reminder occurrence. The unique idempotency key makes repeated
 * scheduling for the same tenant, subscription, and occurrence a no-op.
 */
export async function scheduleReminderDelivery(
  input: ScheduleReminderInput,
): Promise<'inserted' | 'duplicate'> {
  const inserted = await getDb()
    .insert(saasReminderDeliveries)
    .values({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      subscriptionId: input.subscriptionId,
      reminderKey: input.reminderKey,
      idempotencyKey: input.idempotencyKey,
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: input.dueAt,
    })
    .onConflictDoNothing({ target: saasReminderDeliveries.idempotencyKey })
    .returning({ id: saasReminderDeliveries.id });

  return inserted.length === 0 ? 'duplicate' : 'inserted';
}

/**
 * Claims due reminders for one tenant with a single atomic statement. SKIP LOCKED
 * stops concurrent workers from taking the same row. IN_PROGRESS rows keep a
 * lease in next_attempt_at, so a crashed worker's claim becomes due again.
 */
export async function claimDueReminderDeliveries(params: {
  organizationId: string;
  batchSize?: number;
  leaseSeconds?: number;
}): Promise<ClaimedReminderDelivery[]> {
  const batchSize = params.batchSize ?? REMINDER_DELIVERY_BATCH_SIZE;
  const leaseSeconds = params.leaseSeconds ?? REMINDER_DELIVERY_LEASE_SECONDS;

  return getDb().transaction(async (tx) => {
    const claimed = await tx.execute(sql`
      WITH candidates AS (
        SELECT id
        FROM app.saas_reminder_deliveries
        WHERE organization_id = ${params.organizationId}
          AND (
            (status = 'PENDING' AND next_attempt_at <= now())
            OR (status = 'IN_PROGRESS' AND next_attempt_at <= now())
          )
        ORDER BY next_attempt_at, created_at, id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE app.saas_reminder_deliveries AS d
      SET status = 'IN_PROGRESS',
          attempt_count = d.attempt_count + 1,
          last_attempt_at = now(),
          next_attempt_at = now() + (${leaseSeconds} * interval '1 second'),
          updated_at = now()
      FROM candidates
      WHERE d.id = candidates.id
        AND d.organization_id = ${params.organizationId}
      RETURNING d.id,
        d.organization_id AS "organizationId",
        d.subscription_id AS "subscriptionId",
        d.reminder_key AS "reminderKey",
        d.idempotency_key AS "idempotencyKey",
        d.attempt_count AS "attemptCount"
    `);
    return claimed as unknown as ClaimedReminderDelivery[];
  });
}

/** Only an affirmative transport result may call this. Guarded to IN_PROGRESS rows of the same tenant. */
export async function markReminderSent(params: {
  organizationId: string;
  deliveryId: string;
}): Promise<boolean> {
  const updated = await getDb().execute(sql`
    UPDATE app.saas_reminder_deliveries
    SET status = 'SENT',
        sent_at = now(),
        last_error_code = NULL,
        updated_at = now()
    WHERE id = ${params.deliveryId}
      AND organization_id = ${params.organizationId}
      AND status = 'IN_PROGRESS'
    RETURNING id
  `);
  return (updated as unknown as unknown[]).length === 1;
}

export async function markReminderRetry(params: {
  organizationId: string;
  deliveryId: string;
  errorCode: string;
  delaySeconds: number;
}): Promise<boolean> {
  const updated = await getDb().execute(sql`
    UPDATE app.saas_reminder_deliveries
    SET status = 'PENDING',
        next_attempt_at = now() + (${params.delaySeconds} * interval '1 second'),
        last_error_code = ${params.errorCode.slice(0, 128)},
        updated_at = now()
    WHERE id = ${params.deliveryId}
      AND organization_id = ${params.organizationId}
      AND status = 'IN_PROGRESS'
    RETURNING id
  `);
  return (updated as unknown as unknown[]).length === 1;
}

export async function markReminderFailed(params: {
  organizationId: string;
  deliveryId: string;
  errorCode: string;
}): Promise<boolean> {
  const updated = await getDb().execute(sql`
    UPDATE app.saas_reminder_deliveries
    SET status = 'FAILED',
        last_error_code = ${params.errorCode.slice(0, 128)},
        updated_at = now()
    WHERE id = ${params.deliveryId}
      AND organization_id = ${params.organizationId}
      AND status = 'IN_PROGRESS'
    RETURNING id
  `);
  return (updated as unknown as unknown[]).length === 1;
}

export async function countReminderDeliveriesByStatus(
  organizationId: string,
): Promise<Record<string, number>> {
  const rows = (await getDb().execute(sql`
    SELECT status, count(*)::int AS count
    FROM app.saas_reminder_deliveries
    WHERE organization_id = ${organizationId}
    GROUP BY status
  `)) as unknown as Array<{ status: string; count: number }>;

  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}
