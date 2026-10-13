// packages/database/src/schema/saas-refund-history.schema.ts
// Phase 10 (Plan 10-17): separate, tenant-scoped SaaS refund history.
// Refund facts are financial history only. They never mutate subscription or entitlement state,
// and they are deliberately independent of construction-finance tables.
// Replay safety: refunds are unique per provider refund identity; applied events are unique per source event.

import { check, index, integer, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './org.schema';
import { saasInvoices } from './saas-invoice.schema';

const appSchema = pgSchema('app');

export const saasRefunds = appSchema.table(
  'saas_refunds',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    saasInvoiceId: text('saas_invoice_id')
      .notNull()
      .references(() => saasInvoices.id, { onDelete: 'restrict' }),
    stripeMode: text('stripe_mode').notNull(),
    stripeRefundId: text('stripe_refund_id').notNull(),
    stripeInvoiceId: text('stripe_invoice_id').notNull(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    providerEventCreatedAt: timestamp('provider_event_created_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('saas_refunds_provider_identity_uidx').on(t.stripeMode, t.stripeRefundId),
    index('saas_refunds_org_idx').on(t.organizationId, t.createdAt),
    check('saas_refunds_mode_check', sql`${t.stripeMode} IN ('test', 'live')`),
    check('saas_refunds_amount_check', sql`${t.amountCents} >= 0`),
    check('saas_refunds_currency_check', sql`${t.currency} ~ '^[a-z]{3}$'`),
    check(
      'saas_refunds_status_check',
      sql`${t.status} IN ('pending', 'succeeded', 'failed', 'canceled')`,
    ),
  ],
);

export const saasRefundEvents = appSchema.table(
  'saas_refund_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    saasRefundId: text('saas_refund_id')
      .notNull()
      .references(() => saasRefunds.id, { onDelete: 'restrict' }),
    stripeMode: text('stripe_mode').notNull(),
    // Replay identity: a provider event can be applied to refund history at most once.
    sourceEventId: text('source_event_id').notNull(),
    status: text('status').notNull(),
    amountCents: integer('amount_cents').notNull(),
    providerEventCreatedAt: timestamp('provider_event_created_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('saas_refund_events_source_uidx').on(t.stripeMode, t.sourceEventId),
    index('saas_refund_events_refund_idx').on(t.saasRefundId),
    check('saas_refund_events_mode_check', sql`${t.stripeMode} IN ('test', 'live')`),
    check(
      'saas_refund_events_status_check',
      sql`${t.status} IN ('pending', 'succeeded', 'failed', 'canceled')`,
    ),
  ],
);

export type SaasRefund = typeof saasRefunds.$inferSelect;
export type NewSaasRefund = typeof saasRefunds.$inferInsert;
export type SaasRefundEvent = typeof saasRefundEvents.$inferSelect;
export type NewSaasRefundEvent = typeof saasRefundEvents.$inferInsert;
