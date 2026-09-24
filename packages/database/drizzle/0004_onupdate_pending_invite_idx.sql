-- Migration: Add $onUpdate behaviour (Drizzle-only, no SQL needed) and
-- partial unique index on invitations to prevent duplicate pending invites at DB level.

-- The .$onUpdate(() => new Date()) change is handled entirely by Drizzle ORM at
-- query-build time — no DDL is required for that fix.

-- Partial unique index: only one PENDING invitation per (org, email) allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_pending_org_email_unique"
  ON "app"."invitations" ("organization_id", "email")
  WHERE (status = 'PENDING');
