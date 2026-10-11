DO $$ BEGIN
  CREATE TYPE "app"."saas_trial_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CONVERTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "app"."saas_trials" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "tier" text DEFAULT 'Professional' NOT NULL,
  "status" "app"."saas_trial_status" DEFAULT 'ACTIVE' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_trials_org_unique_idx" ON "app"."saas_trials" ("organization_id");
CREATE INDEX IF NOT EXISTS "saas_trials_status_idx" ON "app"."saas_trials" ("status");
CREATE INDEX IF NOT EXISTS "saas_trials_expires_idx" ON "app"."saas_trials" ("expires_at");
