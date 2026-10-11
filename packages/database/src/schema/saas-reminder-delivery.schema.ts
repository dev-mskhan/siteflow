// packages/database/src/schema/saas-reminder-delivery.schema.ts
// Phase 10 (Plan 10-09): durable, tenant-scoped grace-period reminder delivery state.
// Traceability: D-08 (seven-day grace/recovery reminders on Day 1/3/6, email channel).
// Stores only minimal references. Message bodies, secrets, and billing details are never persisted here.

import {
  check,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './org.schema.js';
import { saasSubscriptions } from './saas-billing.schema.js';

const appSchema = pgSchema('app');

export const saasReminderDeliveryStatusEnum = appSchema.enum(
  'saas_reminder_delivery_status',
  ['PENDING', 'IN_PROGRESS', 'SENT', 'FAILED'],
);

export const saasReminderDeliveries = appSchema.table(
  'saas_reminder_deliveries',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => saasSubscriptions.id, { onDelete: 'restrict' }),
    // Deterministic occurrence identity, e.g. 'grace_day_3'. Scoped by tenant and subscription.
    reminderKey: text('reminder_key').notNull(),
    // Unique per organization/subscription/reminder occurrence (D-08 idempotency).
    idempotencyKey: text('idempotency_key').notNull(),
    status: saasReminderDeliveryStatusEnum('status').notNull().default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    // While IN_PROGRESS this doubles as the claim lease expiry, so a crashed worker's claim becomes due again.
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('saas_reminder_deliveries_idempotency_uidx').on(t.idempotencyKey),
    index('saas_reminder_deliveries_org_status_idx').on(t.organizationId, t.status),
    index('saas_reminder_deliveries_due_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} IN ('PENDING', 'IN_PROGRESS')`),
    check(
      'saas_reminder_deliveries_attempt_count_check',
      sql`${t.attemptCount} >= 0`,
    ),
    check(
      'saas_reminder_deliveries_reminder_key_length_check',
      sql`char_length(${t.reminderKey}) BETWEEN 1 AND 64`,
    ),
    check(
      'saas_reminder_deliveries_error_code_length_check',
      sql`${t.lastErrorCode} IS NULL OR char_length(${t.lastErrorCode}) <= 128`,
    ),
    check(
      'saas_reminder_deliveries_sent_at_check',
      sql`(${t.status} = 'SENT') = (${t.sentAt} IS NOT NULL)`,
    ),
  ],
);

export type SaasReminderDelivery = typeof saasReminderDeliveries.$inferSelect;
export type NewSaasReminderDelivery = typeof saasReminderDeliveries.$inferInsert;
