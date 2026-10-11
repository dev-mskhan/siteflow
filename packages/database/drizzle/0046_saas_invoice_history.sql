-- Phase 10 Plan 10-08: separate Stripe SaaS invoice and payment attempt history.
-- Additive and idempotent. Deliberately not registered in Drizzle's journal.

DO $$ BEGIN
  CREATE TYPE "app"."saas_invoice_status" AS ENUM (
    'DRAFT',
    'OPEN',
    'PAID',
    'UNCOLLECTIBLE',
    'VOID'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "app"."saas_payment_attempt_status" AS ENUM (
    'FAILED',
    'SUCCEEDED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "app"."saas_invoices" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
  "stripe_mode" "app"."saas_stripe_mode" NOT NULL,
  "stripe_invoice_id" text NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "stripe_subscription_id" text NOT NULL,
  "invoice_number" text,
  "status" "app"."saas_invoice_status" NOT NULL,
  "amount_due_cents" integer NOT NULL,
  "amount_paid_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "hosted_invoice_url" text,
  "invoice_pdf_url" text,
  "provider_event_created_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saas_invoices_provider_ids_check"
    CHECK (length(trim("stripe_invoice_id")) > 0 AND length(trim("stripe_customer_id")) > 0 AND length(trim("stripe_subscription_id")) > 0),
  CONSTRAINT "saas_invoices_amounts_check"
    CHECK ("amount_due_cents" >= 0 AND "amount_paid_cents" >= 0),
  CONSTRAINT "saas_invoices_currency_check"
    CHECK ("currency" ~ '^[a-z]{3}$'),
  CONSTRAINT "saas_invoices_period_check"
    CHECK ("period_end" >= "period_start")
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_invoices_mode_provider_uidx"
  ON "app"."saas_invoices" ("stripe_mode", "stripe_invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "saas_invoices_id_org_uidx"
  ON "app"."saas_invoices" ("id", "organization_id");
CREATE INDEX IF NOT EXISTS "saas_invoices_org_created_idx"
  ON "app"."saas_invoices" ("organization_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "saas_invoices_org_status_idx"
  ON "app"."saas_invoices" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "saas_invoices_subscription_idx"
  ON "app"."saas_invoices" ("organization_id", "stripe_subscription_id");

CREATE TABLE IF NOT EXISTS "app"."saas_payment_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
  "saas_invoice_id" text NOT NULL,
  "stripe_mode" "app"."saas_stripe_mode" NOT NULL,
  "stripe_invoice_id" text NOT NULL,
  "stripe_payment_intent_id" text NOT NULL,
  "attempt_number" integer NOT NULL,
  "status" "app"."saas_payment_attempt_status" NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "provider_event_created_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saas_payment_attempts_invoice_org_fk"
    FOREIGN KEY ("saas_invoice_id", "organization_id")
    REFERENCES "app"."saas_invoices" ("id", "organization_id") ON DELETE RESTRICT,
  CONSTRAINT "saas_payment_attempts_provider_ids_check"
    CHECK (length(trim("stripe_invoice_id")) > 0 AND length(trim("stripe_payment_intent_id")) > 0),
  CONSTRAINT "saas_payment_attempts_number_check"
    CHECK ("attempt_number" > 0),
  CONSTRAINT "saas_payment_attempts_amount_check"
    CHECK ("amount_cents" >= 0),
  CONSTRAINT "saas_payment_attempts_currency_check"
    CHECK ("currency" ~ '^[a-z]{3}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_payment_attempts_invoice_number_uidx"
  ON "app"."saas_payment_attempts" ("stripe_mode", "stripe_invoice_id", "attempt_number");
CREATE UNIQUE INDEX IF NOT EXISTS "saas_payment_attempts_intent_number_uidx"
  ON "app"."saas_payment_attempts" ("stripe_mode", "stripe_payment_intent_id", "attempt_number");
CREATE INDEX IF NOT EXISTS "saas_payment_attempts_org_invoice_idx"
  ON "app"."saas_payment_attempts" ("organization_id", "saas_invoice_id", "created_at" DESC);
