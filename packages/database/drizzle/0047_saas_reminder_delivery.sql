-- 0047_saas_reminder_delivery.sql
-- Phase 10 Plan 10-09: durable, tenant-scoped grace-period reminder delivery state (D-08).
-- Additive and idempotent. Deliberately not registered in Drizzle's journal.
-- Stores only minimal references; message bodies, secrets, and billing details are not persisted.

DO $$ BEGIN
  CREATE TYPE "app"."saas_reminder_delivery_status" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'SENT',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "app"."saas_reminder_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "subscription_id" text NOT NULL,
  "reminder_key" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "app"."saas_reminder_delivery_status" DEFAULT 'PENDING' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "last_error_code" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saas_reminder_deliveries_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "saas_reminder_deliveries_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "app"."saas_subscriptions"("id") ON DELETE RESTRICT,
  CONSTRAINT "saas_reminder_deliveries_attempt_count_check"
    CHECK ("attempt_count" >= 0),
  CONSTRAINT "saas_reminder_deliveries_reminder_key_length_check"
    CHECK (char_length("reminder_key") BETWEEN 1 AND 64),
  CONSTRAINT "saas_reminder_deliveries_error_code_length_check"
    CHECK ("last_error_code" IS NULL OR char_length("last_error_code") <= 128),
  CONSTRAINT "saas_reminder_deliveries_sent_at_check"
    CHECK (("status" = 'SENT') = ("sent_at" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_reminder_deliveries_idempotency_uidx"
  ON "app"."saas_reminder_deliveries" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "saas_reminder_deliveries_org_status_idx"
  ON "app"."saas_reminder_deliveries" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "saas_reminder_deliveries_due_idx"
  ON "app"."saas_reminder_deliveries" ("next_attempt_at")
  WHERE "status" IN ('PENDING', 'IN_PROGRESS');
