-- Migration: Add organization_settings table

CREATE TYPE "app"."date_format" AS ENUM ('DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD');
CREATE TYPE "app"."time_format" AS ENUM ('H12', 'H24');
CREATE TYPE "app"."unit_system" AS ENUM ('METRIC', 'IMPERIAL');

CREATE TABLE IF NOT EXISTS "app"."organization_settings" (
  "organization_id"         text PRIMARY KEY REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
  "timezone"                text NOT NULL DEFAULT 'UTC',
  "currency"                text NOT NULL DEFAULT 'USD',
  "locale"                  text NOT NULL DEFAULT 'en-US',
  "date_format"             "app"."date_format" NOT NULL DEFAULT 'YYYY_MM_DD',
  "time_format"             "app"."time_format" NOT NULL DEFAULT 'H24',
  "unit_system"             "app"."unit_system" NOT NULL DEFAULT 'METRIC',
  "week_starts_on"          integer NOT NULL DEFAULT 1,
  "fiscal_year_start_month" integer NOT NULL DEFAULT 1,
  "created_at"              timestamptz NOT NULL DEFAULT now(),
  "updated_at"              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "settings_week_starts_on_range"
    CHECK ("week_starts_on" >= 0 AND "week_starts_on" <= 6),
  CONSTRAINT "settings_fiscal_year_month_range"
    CHECK ("fiscal_year_start_month" >= 1 AND "fiscal_year_start_month" <= 12),
  CONSTRAINT "settings_currency_length"
    CHECK (char_length("currency") = 3)
);
