-- 0044_saas_customer_associations.sql
-- Store test/live Stripe customer mappings before webhook-confirmed subscriptions exist.

DO $$ BEGIN
  CREATE TYPE "app"."saas_stripe_mode" AS ENUM('test', 'live');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "app"."saas_customers" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE restrict,
  "stripe_mode" "app"."saas_stripe_mode" NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_customers_org_mode_unique_idx"
  ON "app"."saas_customers" ("organization_id", "stripe_mode");
CREATE UNIQUE INDEX IF NOT EXISTS "saas_customers_stripe_customer_unique_idx"
  ON "app"."saas_customers" ("stripe_customer_id");
