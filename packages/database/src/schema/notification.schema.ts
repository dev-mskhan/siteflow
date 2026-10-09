import { pgSchema, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

const appSchema = pgSchema('app');

export const notificationStatusEnum = appSchema.enum('notification_status', [
  'PENDING',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
]);

export const notificationChannelEnum = appSchema.enum('notification_channel', [
  'EMAIL',
  'IN_APP',
  'REALTIME',
  'WHATSAPP',
]);

export const notifications = appSchema.table(
  'notifications',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id'),
    recipientId: text('recipient_id').notNull(),
    eventId: text('event_id'),
    eventType: text('event_type').notNull(),
    channel: notificationChannelEnum('channel').default('IN_APP').notNull(),
    templateId: text('template_id'),
    payload: jsonb('payload').default({}).notNull(),
    status: notificationStatusEnum('status').default('PENDING').notNull(),
    retryCount: integer('retry_count').default(0).notNull(),
    lastError: text('last_error'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index('notifications_org_idx').on(t.organizationId),
    index('notifications_recipient_idx').on(t.organizationId, t.recipientId),
    index('notifications_status_idx').on(t.organizationId, t.status),
  ],
);

export type NotificationRecord = typeof notifications.$inferSelect;
export type NewNotificationRecord = typeof notifications.$inferInsert;
