-- 0049_saas_refund_history.sql
-- Phase 10 Plan 10-17: separate tenant-scoped SaaS refund history.
-- Additive and idempotent. Deliberately not registered in Drizzle's journal (same convention as 0048).
-- Refund facts never mutate subscription or entitlement state.

CREATE TABLE IF NOT EXISTS "app"."saas_refunds" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
  "saas_invoice_id" text NOT NULL REFERENCES "app"."saas_invoices"("id") ON DELETE RESTRICT,
  "stripe_mode" text NOT NULL,
  "stripe_refund_id" text NOT NULL,
  "stripe_invoice_id" text NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL,
  "provider_event_created_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saas_refunds_mode_check" CHECK ("stripe_mode" IN ('test', 'live')),
  CONSTRAINT "saas_refunds_amount_check" CHECK ("amount_cents" >= 0),
  CONSTRAINT "saas_refunds_currency_check" CHECK ("currency" ~ '^[a-z]{3}$'),
  CONSTRAINT "saas_refunds_status_check" CHECK ("status" IN ('pending', 'succeeded', 'failed', 'canceled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_refunds_provider_identity_uidx"
  ON "app"."saas_refunds" ("stripe_mode", "stripe_refund_id");
CREATE INDEX IF NOT EXISTS "saas_refunds_org_idx"
  ON "app"."saas_refunds" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "app"."saas_refund_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
  "saas_refund_id" text NOT NULL REFERENCES "app"."saas_refunds"("id") ON DELETE RESTRICT,
  "stripe_mode" text NOT NULL,
  "source_event_id" text NOT NULL,
  "status" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "provider_event_created_at" timestamp with time zone NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saas_refund_events_mode_check" CHECK ("stripe_mode" IN ('test', 'live')),
  CONSTRAINT "saas_refund_events_status_check" CHECK ("status" IN ('pending', 'succeeded', 'failed', 'canceled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_refund_events_source_uidx"
  ON "app"."saas_refund_events" ("stripe_mode", "source_event_id");
CREATE INDEX IF NOT EXISTS "saas_refund_events_refund_idx"
  ON "app"."saas_refund_events" ("saas_refund_id");
