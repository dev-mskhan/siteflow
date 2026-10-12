-- 0056_platform_diagnostics_permission.sql
-- Phase 11 Plan 11-06: operational diagnostics read permission (platform admin only).
-- Idempotent. Not registered in meta/_journal.json (same convention as 0048-0055).
-- Rollback: DELETE FROM app.platform_role_permissions WHERE platform_permission_id = 'pperm_read_diagnostics';
--           DELETE FROM app.platform_permissions WHERE id = 'pperm_read_diagnostics';

INSERT INTO "app"."platform_permissions" ("id", "key", "description") VALUES
  ('pperm_read_diagnostics', 'read:diagnostics', 'Read bounded operational diagnostics (queue, webhook inbox, org delivery and storage)')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."platform_role_permissions" ("platform_role_id", "platform_permission_id")
SELECT r."id", p."id"
FROM "app"."platform_roles" r
CROSS JOIN "app"."platform_permissions" p
WHERE r."key" = 'platform_admin' AND p."key" = 'read:diagnostics'
ON CONFLICT DO NOTHING;
