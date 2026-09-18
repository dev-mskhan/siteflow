// apps/server/src/modules/rbac/permissions.seed.ts

/**
 * Canonical permission keys. This is the authoritative list.
 * New permissions must be added here to be usable anywhere in the system.
 */
export const SYSTEM_PERMISSIONS = [
  'organization:read',
  'organization:update',
  'member:read',
  'member:invite',
  'member:update',
  'member:remove',
  'invitation:cancel',
  'settings:read',
  'settings:update',
  'audit:read',
  'project:read',
  'project:update',
  'task:create',
  'task:update',
  'task:update:own',
  'document:read',
  'document:upload',
  'payment:approve',
  'change_order:approve',
] as const;

export type PermissionKey = (typeof SYSTEM_PERMISSIONS)[number];

/**
 * PROVISIONAL: role-to-permission mapping used when seeding default roles on
 * org creation. The spec defines role names but not the complete matrix.
 * Treat this as a working draft — adjust before any role-gating goes to production.
 *
 * Platform Admin is excluded — it is a supra-org concept (Phase 2+).
 */
export const DEFAULT_ORG_ROLES: Record<string, PermissionKey[]> = {
  'Organization Admin': [
    'organization:read',
    'organization:update',
    'member:read',
    'member:invite',
    'member:update',
    'member:remove',
    'invitation:cancel',
    'settings:read',
    'settings:update',
    'audit:read',
    'project:read',
    'project:update',
    'task:create',
    'task:update',
    'document:read',
    'document:upload',
    'payment:approve',
    'change_order:approve',
  ],
  'Project Manager': [
    'organization:read',
    'member:read',
    'project:read',
    'project:update',
    'task:create',
    'task:update',
    'document:read',
    'document:upload',
  ],
  Finance: [
    'organization:read',
    'member:read',
    'project:read',
    'task:update:own',
    'document:read',
    'payment:approve',
  ],
  Procurement: [
    'organization:read',
    'member:read',
    'project:read',
    'document:read',
    'document:upload',
    'change_order:approve',
  ],
  'Site Supervisor': [
    'organization:read',
    'member:read',
    'project:read',
    'task:create',
    'task:update',
    'document:read',
    'document:upload',
  ],
  Subcontractor: [
    'organization:read',
    'project:read',
    'task:update:own',
    'document:read',
  ],
  Client: ['organization:read', 'project:read', 'document:read'],
};
