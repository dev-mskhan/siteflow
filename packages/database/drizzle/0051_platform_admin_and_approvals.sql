-- Phase 11: full-access platform operator role and two-person approvals.
-- Idempotent. Not registered in meta/_journal.json (same convention as 0048-0050).

INSERT INTO "app"."platform_roles" ("id", "key", "description") VALUES
  ('prole_admin', 'platform_admin', 'Full platform operator. Granted via PLATFORM_BOOTSTRAP_EMAIL.')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."platform_role_permissions" ("platform_role_id", "platform_permission_id")
SELECT r."id", p."id"
FROM "app"."platform_roles" r
CROSS JOIN "app"."platform_permissions" p
WHERE r."key" = 'platform_admin'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "app"."platform_approvals" (
  "id" text PRIMARY KEY NOT NULL,
  "action_key" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "requested_by_user_id" text NOT NULL REFERENCES "app"."users"("id"),
  "approved_by_user_id" text REFERENCES "app"."users"("id"),
  "status" text NOT NULL DEFAULT 'pending',
  "reason_code" text NOT NULL,
  "reason_note" text NOT NULL,
  "requested_at" timestamp with time zone NOT NULL DEFAULT now(),
  "decided_at" timestamp with time zone,
  CONSTRAINT "platform_approvals_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'expired')),
  CONSTRAINT "platform_approvals_separation_check"
    CHECK ("approved_by_user_id" IS NULL OR "approved_by_user_id" <> "requested_by_user_id")
);

CREATE INDEX IF NOT EXISTS "platform_approvals_status_idx"
  ON "app"."platform_approvals" ("status", "requested_at");
