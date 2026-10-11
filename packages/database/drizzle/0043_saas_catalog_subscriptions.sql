-- 0043_saas_catalog_subscriptions.sql
-- Phase 10: SaaS Billing Catalog & Subscriptions Model

DO $$ BEGIN
  CREATE TYPE "app"."saas_subscription_status" AS ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'RESTRICTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "app"."saas_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "saas_plans_active_idx" ON "app"."saas_plans" ("is_active");

CREATE TABLE IF NOT EXISTS "app"."saas_price_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL REFERENCES "app"."saas_plans"("id") ON DELETE restrict,
	"version" text DEFAULT 'v1' NOT NULL,
	"interval" text NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"stripe_price_id" text,
	"stripe_product_id" text,
	"limits" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_price_versions_plan_ver_interval_idx" ON "app"."saas_price_versions" ("plan_id", "version", "interval");
CREATE INDEX IF NOT EXISTS "saas_price_versions_stripe_price_idx" ON "app"."saas_price_versions" ("stripe_price_id");
CREATE INDEX IF NOT EXISTS "saas_price_versions_active_idx" ON "app"."saas_price_versions" ("is_active");

CREATE TABLE IF NOT EXISTS "app"."saas_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE restrict,
	"plan_id" text NOT NULL REFERENCES "app"."saas_plans"("id") ON DELETE restrict,
	"price_version_id" text NOT NULL REFERENCES "app"."saas_price_versions"("id") ON DELETE restrict,
	"interval" text NOT NULL,
	"status" "app"."saas_subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"scheduled_plan_id" text,
	"grace_starts_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_subscriptions_org_current_idx" ON "app"."saas_subscriptions" ("organization_id") WHERE is_current = true;
CREATE INDEX IF NOT EXISTS "saas_subscriptions_org_idx" ON "app"."saas_subscriptions" ("organization_id");
CREATE INDEX IF NOT EXISTS "saas_subscriptions_status_idx" ON "app"."saas_subscriptions" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "saas_subscriptions_stripe_sub_idx" ON "app"."saas_subscriptions" ("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "saas_subscriptions_stripe_cust_idx" ON "app"."saas_subscriptions" ("stripe_customer_id");

CREATE TABLE IF NOT EXISTS "app"."saas_subscription_history" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL REFERENCES "app"."saas_subscriptions"("id") ON DELETE restrict,
	"organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE restrict,
	"action" text NOT NULL,
	"from_plan_id" text,
	"to_plan_id" text,
	"from_price_version_id" text,
	"to_price_version_id" text,
	"from_status" text,
	"to_status" text,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "saas_sub_history_org_idx" ON "app"."saas_subscription_history" ("organization_id");
CREATE INDEX IF NOT EXISTS "saas_sub_history_sub_idx" ON "app"."saas_subscription_history" ("subscription_id");
CREATE INDEX IF NOT EXISTS "saas_sub_history_created_idx" ON "app"."saas_subscription_history" ("created_at");

-- Seed approved plans
INSERT INTO "app"."saas_plans" ("id", "name", "tier", "description", "is_active")
VALUES
  ('starter', 'Starter', 'Starter', 'Essential construction management for smaller teams and specialized contractors.', true),
  ('professional', 'Professional', 'Professional', 'Comprehensive operations and multi-project coordination for growing contractors.', true),
  ('enterprise', 'Enterprise', 'Enterprise', 'Full-scale enterprise coordination, custom integrations, and portfolio visibility.', true)
ON CONFLICT ("id") DO NOTHING;

-- Seed approved price versions (v1)
INSERT INTO "app"."saas_price_versions" ("id", "plan_id", "version", "interval", "currency", "unit_amount_cents", "stripe_price_id", "limits", "is_active")
VALUES
  ('starter_month_v1', 'starter', 'v1', 'month', 'usd', 19900, 'price_starter_month_v1', '{"activeProjects": 3, "teamMembers": 10, "storageGb": 50, "apiCallsMonthly": 5000}'::jsonb, true),
  ('starter_year_v1', 'starter', 'v1', 'year', 'usd', 202900, 'price_starter_year_v1', '{"activeProjects": 3, "teamMembers": 10, "storageGb": 50, "apiCallsMonthly": 5000}'::jsonb, true),
  ('pro_month_v1', 'professional', 'v1', 'month', 'usd', 49900, 'price_pro_month_v1', '{"activeProjects": 15, "teamMembers": 50, "storageGb": 250, "apiCallsMonthly": 25000}'::jsonb, true),
  ('pro_year_v1', 'professional', 'v1', 'year', 'usd', 508900, 'price_pro_year_v1', '{"activeProjects": 15, "teamMembers": 50, "storageGb": 250, "apiCallsMonthly": 25000}'::jsonb, true),
  ('ent_month_v1', 'enterprise', 'v1', 'month', 'usd', 99900, 'price_ent_month_v1', '{"activeProjects": 100, "teamMembers": 500, "storageGb": 1000, "apiCallsMonthly": 100000}'::jsonb, true),
  ('ent_year_v1', 'enterprise', 'v1', 'year', 'usd', 1018900, 'price_ent_year_v1', '{"activeProjects": 100, "teamMembers": 500, "storageGb": 1000, "apiCallsMonthly": 100000}'::jsonb, true)
ON CONFLICT ("plan_id", "version", "interval") DO NOTHING;
