-- Add a terminal state for reminders intentionally skipped by recipient preferences.
-- PostgreSQL rejects direct use of a new enum value before the migration
-- transaction commits; the check in 0064 compares status as text instead.
ALTER TYPE "app"."saas_reminder_delivery_status" ADD VALUE IF NOT EXISTS 'SUPPRESSED';

ALTER TABLE "app"."saas_reminder_deliveries"
  ADD COLUMN IF NOT EXISTS "suppressed_at" timestamp with time zone;
