-- Phase 11-04: permission for operator-triggered Stripe webhook inbox recovery.
-- Idempotent. Not registered in meta/_journal.json (same convention as 0048-0051).

INSERT INTO "app"."platform_permissions" ("id", "key", "description") VALUES
  ('pperm_write_billing_sync', 'write:billing_sync', 'Trigger bounded Stripe webhook inbox recovery')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."platform_role_permissions" ("platform_role_id", "platform_permission_id")
SELECT r."id", p."id"
FROM "app"."platform_roles" r
CROSS JOIN "app"."platform_permissions" p
WHERE r."key" = 'platform_admin' AND p."key" = 'write:billing_sync'
ON CONFLICT DO NOTHING;
