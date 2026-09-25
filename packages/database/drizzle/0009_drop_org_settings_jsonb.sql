-- Migration: Remove legacy JSONB settings column from organizations table
ALTER TABLE "app"."organizations" DROP COLUMN IF EXISTS "settings";
