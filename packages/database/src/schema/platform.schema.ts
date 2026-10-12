// packages/database/src/schema/platform.schema.ts
// Phase 11 (Plan 11-01): platform-operator RBAC, separate from org roles.
// No foreign key to organizations: platform authority never derives from org membership.

import { sql } from 'drizzle-orm';
import { check, index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema.js';

export const platformRoles = appSchema.table(
  'platform_roles',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('platform_roles_key_unique').on(t.key)],
);

export const platformPermissions = appSchema.table(
  'platform_permissions',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    description: text('description'),
  },
  (t) => [uniqueIndex('platform_permissions_key_unique').on(t.key)],
);

export const platformRolePermissions = appSchema.table(
  'platform_role_permissions',
  {
    platformRoleId: text('platform_role_id')
      .notNull()
      .references(() => platformRoles.id, { onDelete: 'cascade' }),
    platformPermissionId: text('platform_permission_id')
      .notNull()
      .references(() => platformPermissions.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('platform_role_permissions_unique').on(t.platformRoleId, t.platformPermissionId),
  ],
);

export const platformUserRoles = appSchema.table(
  'platform_user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platformRoleId: text('platform_role_id')
      .notNull()
      .references(() => platformRoles.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('platform_user_roles_active_unique')
      .on(t.userId, t.platformRoleId)
      .where(sql`${t.revokedAt} IS NULL`),
    index('platform_user_roles_role_idx').on(t.platformRoleId),
    check('platform_user_roles_grant_order', sql`${t.revokedAt} IS NULL OR ${t.revokedAt} >= ${t.grantedAt}`),
  ],
);
