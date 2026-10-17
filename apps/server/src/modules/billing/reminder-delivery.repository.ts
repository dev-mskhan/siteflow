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

export async function markReminderSuppressed(params: {
  organizationId: string;
  deliveryId: string;
}): Promise<boolean> {
  const updated = await getDb().execute(sql`
    UPDATE app.saas_reminder_deliveries
    SET status = 'SUPPRESSED',
        suppressed_at = now(),
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

/** Retrying rows are PENDING reminders that have already been attempted at least once. */
export async function countRetryingReminderDeliveries(organizationId: string): Promise<number> {
  const rows = (await getDb().execute(sql`
    SELECT count(*)::int AS count
    FROM app.saas_reminder_deliveries
    WHERE organization_id = ${organizationId}
      AND status = 'PENDING'
      AND attempt_count > 0
  `)) as unknown as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

/**
 * Organizations needing a lifecycle pass: a reminder is due or a claim lease expired,
 * or a current subscription is in past_due grace (so its occurrences can be scheduled).
 */
export async function listOrganizationsWithDueReminders(): Promise<string[]> {
  const rows = (await getDb().execute(sql`
    SELECT organization_id AS "organizationId"
    FROM app.saas_reminder_deliveries
    WHERE status IN ('PENDING', 'IN_PROGRESS')
      AND next_attempt_at <= now()
    UNION
    SELECT organization_id AS "organizationId"
    FROM app.saas_subscriptions
    WHERE is_current = true
      AND status = 'PAST_DUE'
      AND grace_starts_at IS NOT NULL
  `)) as unknown as Array<{ organizationId: string }>;
  return rows.map((row) => row.organizationId);
}

export interface PastDueSubscriptionSnapshot {
  subscriptionId: string;
  status: string;
  graceStartsAt: Date | null;
  planName: string | null;
  amountDueCents: number | null;
  currency: string | null;
}

/** The current subscription for one tenant, scoped by organizationId. */
export async function getCurrentSubscriptionSnapshot(
  organizationId: string,
): Promise<PastDueSubscriptionSnapshot | null> {
  const rows = (await getDb().execute(sql`
    SELECT s.id AS "subscriptionId",
      s.status::text AS "status",
      s.grace_starts_at AS "graceStartsAt",
      p.name AS "planName",
      pv.unit_amount_cents AS "amountDueCents",
      pv.currency AS "currency"
    FROM app.saas_subscriptions s
    LEFT JOIN app.saas_plans p ON p.id = s.plan_id
    LEFT JOIN app.saas_price_versions pv ON pv.id = s.price_version_id
    WHERE s.organization_id = ${organizationId}
      AND s.is_current = true
    LIMIT 1
  `)) as unknown as Array<
    Omit<PastDueSubscriptionSnapshot, 'graceStartsAt'> & { graceStartsAt: Date | string | null }
  >;
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    graceStartsAt: row.graceStartsAt === null ? null : new Date(row.graceStartsAt),
  };
}

/** Active members whose role grants billing:manage in this tenant. */
export async function listBillingAdminRecipients(
  organizationId: string,
): Promise<Array<{ userId: string; email: string }>> {
  const rows = (await getDb().execute(sql`
    SELECT DISTINCT u.id AS "userId", u.email AS "email"
    FROM app.organization_memberships m
    JOIN app.users u ON u.id = m.user_id
    JOIN app.roles r ON r.id = m.role_id AND r.organization_id = m.organization_id
    JOIN app.role_permissions rp ON rp.role_id = r.id
    JOIN app.permissions p ON p.id = rp.permission_id
    WHERE m.organization_id = ${organizationId}
      AND m.status = 'ACTIVE'
      AND u.status = 'ACTIVE'
      AND p.key = 'billing:manage'
  `)) as unknown as Array<{ userId: string; email: string }>;
  return rows;
}

export async function listBillingAdminEmails(organizationId: string): Promise<string[]> {
  const recipients = await listBillingAdminRecipients(organizationId);
  return recipients.map((recipient) => recipient.email);
}
