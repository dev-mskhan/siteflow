import { pgSchema, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

// Re-use the same 'app' PostgreSQL schema — Drizzle merges all tables under the same schema
const appSchema = pgSchema('app');

export const outboxStatusEnum = appSchema.enum('outbox_status', [
  'PENDING',
  'PROCESSED',
  'FAILED',
]);

export const outboxEvents = appSchema.table(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id'),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxStatusEnum('status').default('PENDING').notNull(),
    retryCount: integer('retry_count').default(0).notNull(),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('outbox_events_org_idx').on(t.organizationId),
    index('outbox_events_status_idx').on(t.status, t.createdAt),
  ],
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
