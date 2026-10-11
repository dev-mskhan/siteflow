-- 0045_saas_webhook_inbox.sql
-- Verified Stripe event identities are retained without storing raw provider payloads.

DO $$ BEGIN
  CREATE TYPE "app"."saas_webhook_inbox_status" AS ENUM (
    'PENDING',
    'RETRY',
    'PROCESSING',
    'PROCESSED',
    'FAILED',
    'QUARANTINED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "app"."saas_webhook_inbox" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text DEFAULT 'stripe' NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "event_created_at" timestamp with time zone NOT NULL,
  "live_mode" boolean DEFAULT false NOT NULL,
  "object_type" text,
  "object_id" text,
  "status" "app"."saas_webhook_inbox_status" DEFAULT 'PENDING' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "processed_at" timestamp with time zone,
  "last_error_code" text,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saas_webhook_inbox_provider_check"
    CHECK ("provider" = 'stripe'),
  CONSTRAINT "saas_webhook_inbox_event_id_length_check"
    CHECK (char_length("provider_event_id") BETWEEN 1 AND 255),
  CONSTRAINT "saas_webhook_inbox_event_type_length_check"
    CHECK (char_length("event_type") BETWEEN 1 AND 128),
  CONSTRAINT "saas_webhook_inbox_object_type_length_check"
    CHECK ("object_type" IS NULL OR char_length("object_type") <= 128),
  CONSTRAINT "saas_webhook_inbox_object_id_length_check"
    CHECK ("object_id" IS NULL OR char_length("object_id") <= 255),
  CONSTRAINT "saas_webhook_inbox_attempt_count_check"
    CHECK ("attempt_count" >= 0),
  CONSTRAINT "saas_webhook_inbox_error_code_length_check"
    CHECK ("last_error_code" IS NULL OR char_length("last_error_code") <= 128)
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_webhook_inbox_provider_event_uidx"
  ON "app"."saas_webhook_inbox" ("provider", "provider_event_id");
CREATE INDEX IF NOT EXISTS "saas_webhook_inbox_due_idx"
  ON "app"."saas_webhook_inbox" ("next_attempt_at", "received_at")
  WHERE "status" IN ('PENDING', 'RETRY');
CREATE INDEX IF NOT EXISTS "saas_webhook_inbox_status_received_idx"
  ON "app"."saas_webhook_inbox" ("status", "received_at");
