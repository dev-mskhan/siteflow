// packages/database/src/schema/saas-billing.schema.ts
// Phase 10 — SaaS Billing & Subscription Management: Trial & Subscription Persistence.
// All tables live in the "app" schema, strictly isolated from project commercial finance.

import {
  pgSchema,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './org.schema';

const appSchema = pgSchema('app');

// ── Enums ─────────────────────────────────────────────────────────────────────

export const saasTrialStatusEnum = appSchema.enum('saas_trial_status', [
  'ACTIVE',
  'EXPIRED',
  'CONVERTED',
]);

export const saasSubscriptionStatusEnum = appSchema.enum('saas_subscription_status', [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'RESTRICTED',
]);

export const saasStripeModeEnum = appSchema.enum('saas_stripe_mode', ['test', 'live']);

export const saasCustomers = appSchema.table(
  'saas_customers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    stripeMode: saasStripeModeEnum('stripe_mode').notNull(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('saas_customers_org_mode_unique_idx').on(t.organizationId, t.stripeMode),
    uniqueIndex('saas_customers_stripe_customer_unique_idx').on(t.stripeCustomerId),
  ],
);

// ── SaaS Trials ───────────────────────────────────────────────────────────────

export const saasTrials = appSchema.table(
  'saas_trials',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    tier: text('tier').notNull().default('Professional'),
    status: saasTrialStatusEnum('status').notNull().default('ACTIVE'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('saas_trials_org_unique_idx').on(t.organizationId),
    index('saas_trials_status_idx').on(t.status),
    index('saas_trials_expires_idx').on(t.expiresAt),
  ],
);

// ── SaaS Plan Catalog ─────────────────────────────────────────────────────────

export const saasPlans = appSchema.table(
  'saas_plans',
  {
    id: text('id').primaryKey(), // 'starter', 'professional', 'enterprise'
    name: text('name').notNull(),
    tier: text('tier').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('saas_plans_active_idx').on(t.isActive),
  ],
);

// ── SaaS Price Versions (Immutable) ──────────────────────────────────────────

export const saasPriceVersions = appSchema.table(
  'saas_price_versions',
  {
    id: text('id').primaryKey(), // e.g. 'starter_month_v1'
    planId: text('plan_id')
      .notNull()
      .references(() => saasPlans.id, { onDelete: 'restrict' }),
    version: text('version').notNull().default('v1'),
    interval: text('interval').notNull(), // 'month' | 'year'
    currency: text('currency').notNull().default('usd'),
    unitAmountCents: integer('unit_amount_cents').notNull(),
    stripePriceId: text('stripe_price_id'),
    stripeProductId: text('stripe_product_id'),
    limits: jsonb('limits').notNull(), // { activeProjects, teamMembers, storageGb, apiCallsMonthly }
    isActive: boolean('is_active').notNull().default(true),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('saas_price_versions_plan_ver_interval_idx').on(
      t.planId,
      t.version,
      t.interval,
    ),
    index('saas_price_versions_stripe_price_idx').on(t.stripePriceId),
    index('saas_price_versions_active_idx').on(t.isActive),
  ],
);

// ── SaaS Subscriptions ────────────────────────────────────────────────────────

export const saasSubscriptions = appSchema.table(
  'saas_subscriptions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    planId: text('plan_id')
      .notNull()
      .references(() => saasPlans.id, { onDelete: 'restrict' }),
    priceVersionId: text('price_version_id')
      .notNull()
      .references(() => saasPriceVersions.id, { onDelete: 'restrict' }),
    interval: text('interval').notNull(), // 'month' | 'year'
    status: saasSubscriptionStatusEnum('status').notNull().default('ACTIVE'),
    isCurrent: boolean('is_current').notNull().default(true),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    scheduledPlanId: text('scheduled_plan_id'),
    graceStartsAt: timestamp('grace_starts_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('saas_subscriptions_org_current_idx')
      .on(t.organizationId)
      .where(sql`${t.isCurrent} = true`),
    index('saas_subscriptions_org_idx').on(t.organizationId),
    index('saas_subscriptions_status_idx').on(t.organizationId, t.status),
    index('saas_subscriptions_stripe_sub_idx').on(t.stripeSubscriptionId),
    index('saas_subscriptions_stripe_cust_idx').on(t.stripeCustomerId),
  ],
);

// ── SaaS Subscription History ────────────────────────────────────────────────

export const saasSubscriptionHistory = appSchema.table(
  'saas_subscription_history',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => saasSubscriptions.id, { onDelete: 'restrict' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    fromPlanId: text('from_plan_id'),
    toPlanId: text('to_plan_id'),
    fromPriceVersionId: text('from_price_version_id'),
    toPriceVersionId: text('to_price_version_id'),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    reason: text('reason'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('saas_sub_history_org_idx').on(t.organizationId),
    index('saas_sub_history_sub_idx').on(t.subscriptionId),
    index('saas_sub_history_created_idx').on(t.createdAt),
  ],
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type SaasTrial = typeof saasTrials.$inferSelect;
export type NewSaasTrial = typeof saasTrials.$inferInsert;

export type SaasCustomer = typeof saasCustomers.$inferSelect;
export type NewSaasCustomer = typeof saasCustomers.$inferInsert;

export type SaasPlan = typeof saasPlans.$inferSelect;
export type NewSaasPlan = typeof saasPlans.$inferInsert;

export type SaasPriceVersion = typeof saasPriceVersions.$inferSelect;
export type NewSaasPriceVersion = typeof saasPriceVersions.$inferInsert;

export type SaasSubscription = typeof saasSubscriptions.$inferSelect;
export type NewSaasSubscription = typeof saasSubscriptions.$inferInsert;

export type SaasSubscriptionHistoryEntry = typeof saasSubscriptionHistory.$inferSelect;
export type NewSaasSubscriptionHistoryEntry = typeof saasSubscriptionHistory.$inferInsert;
