CREATE TABLE IF NOT EXISTS "app"."notification_preferences" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text NOT NULL,
  "event_type" text NOT NULL,
  "channel" "app"."notification_channel" NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pref_user_event_channel_unique" ON "app"."notification_preferences" ("organization_id", "user_id", "event_type", "channel");
CREATE INDEX IF NOT EXISTS "pref_org_user_idx" ON "app"."notification_preferences" ("organization_id", "user_id");
