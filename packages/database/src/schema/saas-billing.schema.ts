// packages/database/src/schema/saas-billing.schema.ts
// Phase 10 — SaaS Billing & Subscription Management: Trial & Subscription Persistence.
// All tables live in the "app" schema, strictly isolated from project commercial finance.

import { pgSchema, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

const appSchema = pgSchema('app');

export const saasTrialStatusEnum = appSchema.enum('saas_trial_status', [
  'ACTIVE',
  'EXPIRED',
  'CONVERTED',
]);

export const saasTrials = appSchema.table(
  'saas_trials',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    tier: text('tier').notNull().default('Professional'),
    status: saasTrialStatusEnum('status').notNull().default('ACTIVE'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('saas_trials_org_unique_idx').on(t.organizationId),
    index('saas_trials_status_idx').on(t.status),
    index('saas_trials_expires_idx').on(t.expiresAt),
  ],
);

export type SaasTrial = typeof saasTrials.$inferSelect;
export type NewSaasTrial = typeof saasTrials.$inferInsert;
