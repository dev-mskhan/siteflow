-- Add a terminal state for reminders intentionally skipped by recipient preferences.
ALTER TYPE "app"."saas_reminder_delivery_status" ADD VALUE IF NOT EXISTS 'SUPPRESSED';

ALTER TABLE "app"."saas_reminder_deliveries"
  ADD COLUMN IF NOT EXISTS "suppressed_at" timestamp with time zone;

DO $$ BEGIN
  ALTER TABLE "app"."saas_reminder_deliveries"
    ADD CONSTRAINT "saas_reminder_deliveries_suppressed_at_check"
    CHECK (("status" = 'SUPPRESSED') = ("suppressed_at" IS NOT NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
