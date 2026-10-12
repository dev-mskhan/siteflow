-- 0050_platform_rbac.sql
-- Phase 11 Plan 11-01: platform-operator RBAC, separate from org roles.
-- Additive and idempotent. Deliberately not registered in Drizzle's journal (same convention as 0048/0049).
-- No foreign key to organizations: platform authority never derives from org membership.
-- Rollback: DROP TABLE app.platform_user_roles, app.platform_role_permissions, app.platform_permissions, app.platform_roles;

CREATE TABLE IF NOT EXISTS "app"."platform_roles" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_roles_key_unique"
  ON "app"."platform_roles" ("key");

CREATE TABLE IF NOT EXISTS "app"."platform_permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "description" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_permissions_key_unique"
  ON "app"."platform_permissions" ("key");

CREATE TABLE IF NOT EXISTS "app"."platform_role_permissions" (
  "platform_role_id" text NOT NULL REFERENCES "app"."platform_roles"("id") ON DELETE CASCADE,
  "platform_permission_id" text NOT NULL REFERENCES "app"."platform_permissions"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_role_permissions_unique"
  ON "app"."platform_role_permissions" ("platform_role_id", "platform_permission_id");

CREATE TABLE IF NOT EXISTS "app"."platform_user_roles" (
  "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "platform_role_id" text NOT NULL REFERENCES "app"."platform_roles"("id") ON DELETE CASCADE,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "platform_user_roles_grant_order" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "granted_at")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_user_roles_active_unique"
  ON "app"."platform_user_roles" ("user_id", "platform_role_id") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "platform_user_roles_role_idx"
  ON "app"."platform_user_roles" ("platform_role_id");

-- Deny-by-default: permissions are granted only through platform roles.
INSERT INTO "app"."platform_permissions" ("id", "key", "description") VALUES
  ('pperm_read_organizations', 'read:organizations', 'Read organizations and accounts'),
  ('pperm_write_organization_lifecycle', 'write:organization_lifecycle', 'Change organization or account lifecycle state'),
  ('pperm_read_billing', 'read:billing', 'Read SaaS billing administration data'),
  ('pperm_write_billing_override', 'write:billing_override', 'Create or revoke entitlement overrides'),
  ('pperm_read_audit', 'read:audit', 'Read platform audit history'),
  ('pperm_read_diagnostics', 'read:diagnostics', 'Read operational diagnostics'),
  ('pperm_write_job_retry', 'write:job_retry', 'Retry safe, idempotent operational jobs'),
  ('pperm_manage_support_grants', 'manage:support_grants', 'Create, approve, and revoke support grants')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."platform_roles" ("id", "key", "description") VALUES
  ('prole_support', 'platform_support', 'Read-only support; no tenant project or financial data by default')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."platform_role_permissions" ("platform_role_id", "platform_permission_id") VALUES
  ('prole_support', 'pperm_read_organizations')
ON CONFLICT DO NOTHING;
