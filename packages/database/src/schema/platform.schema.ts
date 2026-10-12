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

export const platformApprovals = appSchema.table(
  'platform_approvals',
  {
    id: text('id').primaryKey(),
    actionKey: text('action_key').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    requestedByUserId: text('requested_by_user_id')
      .notNull()
      .references(() => users.id),
    approvedByUserId: text('approved_by_user_id').references(() => users.id),
    status: text('status').notNull().default('pending'),
    reasonCode: text('reason_code').notNull(),
    reasonNote: text('reason_note').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    index('platform_approvals_status_idx').on(t.status, t.requestedAt),
    check(
      'platform_approvals_status_check',
      sql`${t.status} IN ('pending', 'approved', 'rejected', 'expired')`,
    ),
    check(
      'platform_approvals_separation_check',
      sql`${t.approvedByUserId} IS NULL OR ${t.approvedByUserId} <> ${t.requestedByUserId}`,
    ),
  ],
);
