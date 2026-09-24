// packages/database/src/schema/org.schema.ts
import {
  pgSchema,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.schema';

const appSchema = pgSchema('app');

// ── Enums ─────────────────────────────────────────────────────────────────────

export const orgStatusEnum = appSchema.enum('org_status', [
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
]);

export const memberStatusEnum = appSchema.enum('member_status', [
  'ACTIVE',
  'SUSPENDED',
  'REMOVED',
]);

export const invitationStatusEnum = appSchema.enum('invitation_status', [
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'CANCELLED',
]);

// ── Organization ──────────────────────────────────────────────────────────────

export const organizations = appSchema.table(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    country: text('country'),  // ISO 3166-1 alpha-2, nullable
    status: orgStatusEnum('status').default('ACTIVE').notNull(),
    settings: jsonb('settings').default({}).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex('organizations_slug_unique').on(t.slug)],
);

// ── Role ──────────────────────────────────────────────────────────────────────

export const roles = appSchema.table(
  'roles',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex('roles_org_name_unique').on(t.organizationId, t.name)],
);

// ── Permission ────────────────────────────────────────────────────────────────

export const permissions = appSchema.table('permissions', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  description: text('description'),
});

// ── RolePermission (join) ─────────────────────────────────────────────────────

export const rolePermissions = appSchema.table(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('role_permissions_unique').on(t.roleId, t.permissionId)],
);

// ── OrganizationMembership ────────────────────────────────────────────────────

export const organizationMemberships = appSchema.table(
  'organization_memberships',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id),
    status: memberStatusEnum('status').default('ACTIVE').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('memberships_org_user_unique').on(t.organizationId, t.userId),
    index('memberships_org_id_idx').on(t.organizationId),
    index('memberships_user_id_idx').on(t.userId),
  ],
);

// ── Invitation ────────────────────────────────────────────────────────────────

export const invitations = appSchema.table(
  'invitations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id),
    tokenHash: text('token_hash').notNull(),
    status: invitationStatusEnum('status').default('PENDING').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index('invitations_email_org_idx').on(t.email, t.organizationId),
    uniqueIndex('invitations_token_hash_unique').on(t.tokenHash),
    uniqueIndex('invitations_pending_org_email_unique')
      .on(t.organizationId, t.email)
      .where(sql`${t.status} = 'PENDING'`),
  ],
);

// ── AuditLog ──────────────────────────────────────────────────────────────────

export const auditLogs = appSchema.table(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    actorUserId: text('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata').default({}),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_org_idx').on(t.organizationId),
    index('audit_logs_actor_idx').on(t.actorUserId),
  ],
);

// ── TypeScript Types ──────────────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type Membership = typeof organizationMemberships.$inferSelect;
export type NewMembership = typeof organizationMemberships.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
