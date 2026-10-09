import { pgSchema, text, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { notificationChannelEnum } from './notification.schema';

const appSchema = pgSchema('app');

export const notificationPreferences = appSchema.table(
  'notification_preferences',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    userId: text('user_id').notNull(),
    eventType: text('event_type').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('pref_user_event_channel_unique').on(t.organizationId, t.userId, t.eventType, t.channel),
    index('pref_org_user_idx').on(t.organizationId, t.userId),
  ],
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
