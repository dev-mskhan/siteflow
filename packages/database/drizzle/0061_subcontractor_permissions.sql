-- 0061_subcontractor_permissions.sql
-- Org-level subcontractor master-data permissions (subcontractor:read|create|update).
-- Idempotent. Not registered in meta/_journal.json (same convention as 0056/0059).
-- Grants mirror DEFAULT_ORG_ROLES in apps/server/src/modules/rbac/permissions.seed.ts.
-- Rollback:
--   DELETE FROM app.role_permissions WHERE permission_id IN (SELECT id FROM app.permissions WHERE key LIKE 'subcontractor:%');
--   DELETE FROM app.permissions WHERE key LIKE 'subcontractor:%';

INSERT INTO "app"."permissions" ("id", "key", "description") VALUES
  ('perm_subcontractor_read', 'subcontractor:read', 'Read organization subcontractor master data'),
  ('perm_subcontractor_create', 'subcontractor:create', 'Create organization subcontractors and contacts'),
  ('perm_subcontractor_update', 'subcontractor:update', 'Update organization subcontractors and contacts')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "app"."roles" r
CROSS JOIN "app"."permissions" p
WHERE r."is_system" = true
  AND (
    (r."name" IN ('Organization Admin', 'Project Manager', 'Procurement')
      AND p."key" IN ('subcontractor:read', 'subcontractor:create', 'subcontractor:update'))
    OR (r."name" = 'Finance' AND p."key" = 'subcontractor:read')
  )
ON CONFLICT DO NOTHING;
