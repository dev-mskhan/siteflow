-- Migration: Replace case-sensitive users_email_unique with case-insensitive expression index

-- The original index is owned by a UNIQUE constraint on fresh installs.
ALTER TABLE "app"."users" DROP CONSTRAINT IF EXISTS "users_email_unique";
DROP INDEX IF EXISTS "app"."users_email_unique";

-- Create case-insensitive unique index on lower(email)
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_lower"
  ON "app"."users" (lower("email"));
