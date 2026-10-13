// Phase 10 — Stripe-generated SaaS invoice and payment-attempt history.
// These organization billing records are deliberately separate from project finance.

import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './org.schema';
import { saasStripeModeEnum } from './saas-billing.schema';

const appSchema = pgSchema('app');

export const saasInvoiceStatusEnum = appSchema.enum('saas_invoice_status', [
  'DRAFT',
  'OPEN',
  'PAID',
  'UNCOLLECTIBLE',
  'VOID',
]);

export const saasPaymentAttemptStatusEnum = appSchema.enum(
  'saas_payment_attempt_status',
  ['FAILED', 'SUCCEEDED'],
);

export const saasInvoices = appSchema.table(
  'saas_invoices',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    stripeMode: saasStripeModeEnum('stripe_mode').notNull(),
    stripeInvoiceId: text('stripe_invoice_id').notNull(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    invoiceNumber: text('invoice_number'),
    status: saasInvoiceStatusEnum('status').notNull(),
    amountDueCents: integer('amount_due_cents').notNull(),
    amountPaidCents: integer('amount_paid_cents').notNull(),
    currency: text('currency').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    hostedInvoiceUrl: text('hosted_invoice_url'),
    invoicePdfUrl: text('invoice_pdf_url'),
    taxCalculationId: text('tax_calculation_id'),
    taxAmountCents: integer('tax_amount_cents'),
    taxCurrency: text('tax_currency'),
    taxJurisdictionCountries: text('tax_jurisdiction_countries').array(),
    providerEventCreatedAt: timestamp('provider_event_created_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('saas_invoices_mode_provider_uidx').on(t.stripeMode, t.stripeInvoiceId),
    uniqueIndex('saas_invoices_id_org_uidx').on(t.id, t.organizationId),
    index('saas_invoices_org_created_idx').on(
      t.organizationId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index('saas_invoices_org_status_idx').on(t.organizationId, t.status),
    index('saas_invoices_subscription_idx').on(
      t.organizationId,
      t.stripeSubscriptionId,
    ),
    check(
      'saas_invoices_provider_ids_check',
      sql`length(trim(${t.stripeInvoiceId})) > 0 AND length(trim(${t.stripeCustomerId})) > 0 AND length(trim(${t.stripeSubscriptionId})) > 0`,
    ),
    check(
      'saas_invoices_amounts_check',
      sql`${t.amountDueCents} >= 0 AND ${t.amountPaidCents} >= 0`,
    ),
    check('saas_invoices_currency_check', sql`${t.currency} ~ '^[a-z]{3}$'`),
    check('saas_invoices_period_check', sql`${t.periodEnd} >= ${t.periodStart}`),
    check(
      'saas_invoices_tax_facts_check',
      sql`(
        ${t.taxCalculationId} IS NULL AND ${t.taxAmountCents} IS NULL
        AND ${t.taxCurrency} IS NULL AND ${t.taxJurisdictionCountries} IS NULL
      ) OR (
        length(trim(${t.taxCalculationId})) > 0
        AND ${t.taxAmountCents} >= 0
        AND ${t.taxCurrency} ~ '^[a-z]{3}$'
        AND ${t.taxJurisdictionCountries} IS NOT NULL
      )`,
    ),
  ],
);

export const saasPaymentAttempts = appSchema.table(
  'saas_payment_attempts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    saasInvoiceId: text('saas_invoice_id').notNull(),
    stripeMode: saasStripeModeEnum('stripe_mode').notNull(),
    stripeInvoiceId: text('stripe_invoice_id').notNull(),
    stripePaymentIntentId: text('stripe_payment_intent_id').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    status: saasPaymentAttemptStatusEnum('status').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    providerEventCreatedAt: timestamp('provider_event_created_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: 'saas_payment_attempts_invoice_org_fk',
      columns: [t.saasInvoiceId, t.organizationId],
      foreignColumns: [saasInvoices.id, saasInvoices.organizationId],
    }).onDelete('restrict'),
    uniqueIndex('saas_payment_attempts_invoice_number_uidx').on(
      t.stripeMode,
      t.stripeInvoiceId,
      t.attemptNumber,
    ),
    uniqueIndex('saas_payment_attempts_intent_number_uidx').on(
      t.stripeMode,
      t.stripePaymentIntentId,
      t.attemptNumber,
    ),
    index('saas_payment_attempts_org_invoice_idx').on(
      t.organizationId,
      t.saasInvoiceId,
      t.createdAt.desc(),
    ),
    check(
      'saas_payment_attempts_provider_ids_check',
      sql`length(trim(${t.stripeInvoiceId})) > 0 AND length(trim(${t.stripePaymentIntentId})) > 0`,
    ),
    check('saas_payment_attempts_number_check', sql`${t.attemptNumber} > 0`),
    check('saas_payment_attempts_amount_check', sql`${t.amountCents} >= 0`),
    check('saas_payment_attempts_currency_check', sql`${t.currency} ~ '^[a-z]{3}$'`),
  ],
);

export type SaasInvoice = typeof saasInvoices.$inferSelect;
export type NewSaasInvoice = typeof saasInvoices.$inferInsert;
export type SaasPaymentAttempt = typeof saasPaymentAttempts.$inferSelect;
export type NewSaasPaymentAttempt = typeof saasPaymentAttempts.$inferInsert;
