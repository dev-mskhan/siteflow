/**
 * ROLE_PERMISSIONS — frontend mirror of permissions.seed.ts on the server.
 *
 * This map is used by OrgBootstrap to derive the current user's permission
 * array from their roleName — without a dedicated /me/membership endpoint.
 *
 * CRITICAL: Keep this in sync with DEFAULT_ORG_ROLES in
 * apps/server/src/modules/rbac/permissions.seed.ts.
 * The server is the real enforcement layer. This is UI-only.
 */

export type PermissionKey =
  | 'organization:read'
  | 'organization:update'
  | 'member:read'
  | 'member:invite'
  | 'member:update'
  | 'member:remove'
  | 'invitation:cancel'
  | 'settings:read'
  | 'settings:update'
  | 'audit:read'
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:delete'
  | 'project:admin'
  | 'project:read:any'
  | 'project:write:any'
  | 'task:create'
  | 'task:update'
  | 'task:update:own'
  | 'document:read'
  | 'document:upload'
  | 'payment:approve'
  | 'change_order:approve'
  | 'billing:read'
  | 'billing:manage'
  | 'ai.runs.create'
  | 'ai.runs.read'
  | 'ai.runs.cancel'
  | 'ai.approvals.decide';

export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  'Organization Admin': [
    'organization:read', 'organization:update',
    'member:read', 'member:invite', 'member:update', 'member:remove',
    'invitation:cancel',
    'settings:read', 'settings:update',
    'audit:read',
    'project:create', 'project:read', 'project:update', 'project:delete',
    'project:admin', 'project:read:any', 'project:write:any',
    'task:create', 'task:update',
    'document:read', 'document:upload',
    'payment:approve', 'change_order:approve',
    'billing:read', 'billing:manage',
    'ai.runs.create', 'ai.runs.read', 'ai.runs.cancel', 'ai.approvals.decide',
  ],
  'Project Manager': [
    'organization:read', 'member:read',
    'project:create', 'project:read', 'project:update',
    'task:create', 'task:update',
    'document:read', 'document:upload',
    'ai.runs.create', 'ai.runs.read', 'ai.runs.cancel',
  ],
  'Finance': [
    'organization:read', 'member:read',
    'project:read', 'task:update:own',
    'document:read', 'payment:approve', 'billing:read',
    'ai.runs.create', 'ai.runs.read', 'ai.runs.cancel', 'ai.approvals.decide',
  ],
  'Procurement': [
    'organization:read', 'member:read',
    'project:read',
    'document:read', 'document:upload',
    'change_order:approve',
  ],
  'Site Supervisor': [
    'organization:read', 'member:read',
    'project:read',
    'task:create', 'task:update',
    'document:read', 'document:upload',
  ],
  'Subcontractor': [
    'organization:read',
    'project:read', 'task:update:own',
    'document:read',
  ],
  'Client': [
    'organization:read', 'project:read', 'document:read',
  ],
};

/** Derives permissions from a role name. Falls back to empty array for unknown roles. */
export function derivePermissions(roleName: string): PermissionKey[] {
  return ROLE_PERMISSIONS[roleName] ?? [];
}
