ALTER TABLE "app"."notifications"
  ADD COLUMN IF NOT EXISTS "read_at" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_delivery_dedupe_unique"
  ON "app"."notifications" ("organization_id", "recipient_id", "event_id", "channel");
