import {
  check,
  boolean,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const appSchema = pgSchema('app');

export const saasWebhookInboxStatusEnum = appSchema.enum(
  'saas_webhook_inbox_status',
  ['PENDING', 'RETRY', 'PROCESSING', 'PROCESSED', 'FAILED', 'QUARANTINED'],
);

export const saasWebhookInbox = appSchema.table(
  'saas_webhook_inbox',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull().default('stripe'),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    eventCreatedAt: timestamp('event_created_at', { withTimezone: true }).notNull(),
    liveMode: boolean('live_mode').notNull().default(false),
    objectType: text('object_type'),
    objectId: text('object_id'),
    status: saasWebhookInboxStatusEnum('status').notNull().default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('saas_webhook_inbox_provider_event_uidx').on(
      t.provider,
      t.providerEventId,
    ),
    index('saas_webhook_inbox_due_idx')
      .on(t.nextAttemptAt, t.receivedAt)
      .where(sql`${t.status} IN ('PENDING', 'RETRY')`),
    index('saas_webhook_inbox_status_received_idx').on(
      t.status,
      t.receivedAt,
    ),
    check(
      'saas_webhook_inbox_provider_check',
      sql`${t.provider} = 'stripe'`,
    ),
    check(
      'saas_webhook_inbox_event_id_length_check',
      sql`char_length(${t.providerEventId}) BETWEEN 1 AND 255`,
    ),
    check(
      'saas_webhook_inbox_event_type_length_check',
      sql`char_length(${t.eventType}) BETWEEN 1 AND 128`,
    ),
    check(
      'saas_webhook_inbox_object_type_length_check',
      sql`${t.objectType} IS NULL OR char_length(${t.objectType}) <= 128`,
    ),
    check(
      'saas_webhook_inbox_object_id_length_check',
      sql`${t.objectId} IS NULL OR char_length(${t.objectId}) <= 255`,
    ),
    check(
      'saas_webhook_inbox_attempt_count_check',
      sql`${t.attemptCount} >= 0`,
    ),
    check(
      'saas_webhook_inbox_error_code_length_check',
      sql`${t.lastErrorCode} IS NULL OR char_length(${t.lastErrorCode}) <= 128`,
    ),
  ],
);

export type SaasWebhookInboxEvent = typeof saasWebhookInbox.$inferSelect;
export type NewSaasWebhookInboxEvent = typeof saasWebhookInbox.$inferInsert;
