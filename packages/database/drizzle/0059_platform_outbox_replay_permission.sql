-- Platform operators must have an explicit permission to replay failed outbox events.
INSERT INTO "app"."platform_permissions" ("id", "key", "description") VALUES
  ('pperm_write_outbox_replay', 'write:outbox_replay', 'Replay a failed transactional outbox event')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."platform_role_permissions" ("platform_role_id", "platform_permission_id")
SELECT r."id", p."id"
FROM "app"."platform_roles" r
CROSS JOIN "app"."platform_permissions" p
WHERE r."key" = 'platform_admin' AND p."key" = 'write:outbox_replay'
ON CONFLICT DO NOTHING;
