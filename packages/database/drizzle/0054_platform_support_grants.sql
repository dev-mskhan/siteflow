-- 0054_platform_support_grants.sql
-- Phase 11 Plan 11-05: time-limited, scoped, second-operator-approved support grants.
-- Idempotent. Not registered in meta/_journal.json (same convention as 0048-0053).
-- Rollback: DROP TABLE app.platform_support_grants;

CREATE TABLE IF NOT EXISTS "app"."platform_support_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "operator_user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
  "reason_code" text NOT NULL,
  "reason_note" text NOT NULL,
  "scopes" text[] NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "requested_by_user_id" text NOT NULL REFERENCES "app"."users"("id"),
  "approved_by_user_id" text REFERENCES "app"."users"("id"),
  "requested_at" timestamp with time zone NOT NULL DEFAULT now(),
  "approved_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_by_user_id" text REFERENCES "app"."users"("id"),
  CONSTRAINT "platform_support_grants_status_check"
    CHECK ("status" IN ('pending', 'active', 'rejected', 'revoked')),
  CONSTRAINT "platform_support_grants_separation_check"
    CHECK ("approved_by_user_id" IS NULL OR "approved_by_user_id" <> "requested_by_user_id"),
  CONSTRAINT "platform_support_grants_ttl_check"
    CHECK ("expires_at" IS NULL OR ("approved_at" IS NOT NULL
      AND "expires_at" > "approved_at"
      AND "expires_at" <= "approved_at" + interval '24 hours')),
  CONSTRAINT "platform_support_grants_active_check"
    CHECK ("status" <> 'active' OR ("approved_by_user_id" IS NOT NULL AND "expires_at" IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS "platform_support_grants_operator_idx"
  ON "app"."platform_support_grants" ("operator_user_id", "status", "expires_at");
CREATE INDEX IF NOT EXISTS "platform_support_grants_org_idx"
  ON "app"."platform_support_grants" ("organization_id", "status");

-- Platform support role may use grants; admin already has every permission (0051).
INSERT INTO "app"."platform_permissions" ("id", "key", "description") VALUES
  ('pperm_use_support_grant', 'use:support_grant', 'Use an approved, unexpired support grant (read-only)')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."platform_role_permissions" ("platform_role_id", "platform_permission_id") VALUES
  ('prole_support', 'pperm_use_support_grant')
ON CONFLICT DO NOTHING;

INSERT INTO "app"."platform_role_permissions" ("platform_role_id", "platform_permission_id")
SELECT r."id", p."id"
FROM "app"."platform_roles" r
CROSS JOIN "app"."platform_permissions" p
WHERE r."key" = 'platform_admin' AND p."key" = 'use:support_grant'
ON CONFLICT DO NOTHING;
