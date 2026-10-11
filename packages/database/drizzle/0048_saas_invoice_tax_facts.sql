-- 0048_saas_invoice_tax_facts.sql
-- Phase 10 Plan 10-16: nullable, provider-verified Stripe Tax facts on SaaS invoices.
-- Additive and idempotent. Deliberately not registered in Drizzle's journal.
-- NULL means "not calculated" (optional Tax disabled or not applicable), never a verified zero.

ALTER TABLE "app"."saas_invoices"
  ADD COLUMN IF NOT EXISTS "tax_calculation_id" text,
  ADD COLUMN IF NOT EXISTS "tax_amount_cents" integer,
  ADD COLUMN IF NOT EXISTS "tax_currency" text,
  ADD COLUMN IF NOT EXISTS "tax_jurisdiction_countries" text[];

DO $$ BEGIN
  ALTER TABLE "app"."saas_invoices"
    ADD CONSTRAINT "saas_invoices_tax_facts_check"
    CHECK (
      (
        "tax_calculation_id" IS NULL AND "tax_amount_cents" IS NULL
        AND "tax_currency" IS NULL AND "tax_jurisdiction_countries" IS NULL
      ) OR (
        length(trim("tax_calculation_id")) > 0
        AND "tax_amount_cents" >= 0
        AND "tax_currency" ~ '^[a-z]{3}$'
        AND "tax_jurisdiction_countries" IS NOT NULL
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
