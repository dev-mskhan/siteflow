-- Migration: Add country column to organizations table
ALTER TABLE "app"."organizations" ADD COLUMN IF NOT EXISTS "country" text;
