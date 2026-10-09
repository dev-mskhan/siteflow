DO $$ BEGIN
  CREATE TYPE "app"."notification_status" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "app"."notification_channel" AS ENUM ('EMAIL', 'IN_APP', 'REALTIME', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "app"."notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "project_id" text,
  "recipient_id" text NOT NULL,
  "event_id" text,
  "event_type" text NOT NULL,
  "channel" "app"."notification_channel" DEFAULT 'IN_APP' NOT NULL,
  "template_id" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "app"."notification_status" DEFAULT 'PENDING' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notifications_org_idx" ON "app"."notifications" ("organization_id");
CREATE INDEX IF NOT EXISTS "notifications_recipient_idx" ON "app"."notifications" ("organization_id", "recipient_id");
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "app"."notifications" ("organization_id", "status");
