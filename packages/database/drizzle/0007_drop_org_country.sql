-- Migration: Remove country column from organizations table (now lives in organization_profiles)
ALTER TABLE "app"."organizations" DROP COLUMN IF EXISTS "country";
