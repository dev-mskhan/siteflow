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
  | 'ai.approvals.decide'
  | 'supplier:read'
  | 'supplier:create'
  | 'supplier:update'
  | 'material:read'
  | 'material:create'
  | 'material:update'
  | 'project.field-log.read'
  | 'project.field-log.create'
  | 'project.field-log.update'
  | 'project.field-log.submit'
  | 'project.field-log.lock'
  | 'project.issue.read'
  | 'project.issue.create'
  | 'project.issue.update'
  | 'project.issue.transition'
  | 'project.subcontractor.read'
  | 'project.subcontractor.create'
  | 'project.subcontractor.update'
  | 'project.subcontractor.assign'
  | 'project.performance.read'
  | 'project.task.create'
  | 'project.task.update'
  | 'project.task.delete'
  | 'project.baseline.read'
  | 'project.baseline.create'
  | 'project.baseline.activate'
  | 'project.baseline.delete'
  | 'project.calendar.manage'
  | 'project.schedule.recalculate'
  | 'project.dependency.create'
  | 'project.dependency.delete'
  | 'project.material_request.read'
  | 'project.material_request.create'
  | 'project.material_request.update'
  | 'project.material_request.submit'
  | 'project.material_request.cancel'
  | 'project.quote.read'
  | 'project.quote.create'
  | 'project.quote.update'
  | 'project.quote.submit'
  | 'project.quote.accept'
  | 'project.quote.reject'
  | 'project.purchase_order.read'
  | 'project.purchase_order.create'
  | 'project.purchase_order.update'
  | 'project.purchase_order.submit'
  | 'project.purchase_order.approve'
  | 'project.purchase_order.send'
  | 'project.purchase_order.cancel'
  | 'project.procurement_approval.read'
  | 'project.procurement_approval.create'
  | 'project.procurement_approval.approve'
  | 'project.procurement_approval.reject'
  | 'project.committed_cost.read'
  | 'project.delivery.read'
  | 'project.delivery.create'
  | 'project.delivery.update'
  | 'project.receipt.read'
  | 'project.receipt.create'
  | 'project.receipt.post'
  | 'project.receipt.void'
  | 'project.inventory.read'
  | 'project.inventory.adjust';

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
    'supplier:read', 'supplier:create', 'supplier:update',
    'material:read', 'material:create', 'material:update',
    'project.field-log.read', 'project.field-log.create', 'project.field-log.update', 'project.field-log.submit', 'project.field-log.lock',
    'project.issue.read', 'project.issue.create', 'project.issue.update', 'project.issue.transition',
    'project.task.read', 'project.task.create', 'project.task.update', 'project.task.delete',
    'project.baseline.read', 'project.baseline.create', 'project.baseline.activate', 'project.baseline.delete',
    'project.calendar.manage', 'project.schedule.recalculate', 'project.dependency.create', 'project.dependency.delete',
    'project.subcontractor.read', 'project.subcontractor.create', 'project.subcontractor.update', 'project.subcontractor.assign',
    'project.performance.read',
    'project.material_request.read', 'project.material_request.create', 'project.material_request.update', 'project.material_request.submit', 'project.material_request.cancel',
    'project.quote.read', 'project.quote.create', 'project.quote.update', 'project.quote.submit', 'project.quote.accept', 'project.quote.reject',
    'project.purchase_order.read', 'project.purchase_order.create', 'project.purchase_order.update', 'project.purchase_order.submit', 'project.purchase_order.approve', 'project.purchase_order.send', 'project.purchase_order.cancel',
    'project.procurement_approval.read', 'project.procurement_approval.create', 'project.procurement_approval.approve', 'project.procurement_approval.reject',
    'project.committed_cost.read',
    'project.delivery.read', 'project.delivery.create', 'project.delivery.update',
    'project.receipt.read', 'project.receipt.create', 'project.receipt.post', 'project.receipt.void',
    'project.inventory.read', 'project.inventory.adjust',
  ],
  'Project Manager': [
    'organization:read', 'member:read',
    'project:create', 'project:read', 'project:update',
    'task:create', 'task:update',
    'document:read', 'document:upload',
    'ai.runs.create', 'ai.runs.read', 'ai.runs.cancel',
    'supplier:read', 'material:read',
    'project.field-log.read', 'project.field-log.create', 'project.field-log.update', 'project.field-log.submit', 'project.field-log.lock',
    'project.issue.read', 'project.issue.create', 'project.issue.update', 'project.issue.transition',
    'project.task.read', 'project.task.create', 'project.task.update', 'project.task.delete',
    'project.baseline.read', 'project.baseline.create', 'project.baseline.activate', 'project.baseline.delete',
    'project.calendar.manage', 'project.schedule.recalculate', 'project.dependency.create', 'project.dependency.delete',
    'project.subcontractor.read', 'project.subcontractor.create', 'project.subcontractor.update', 'project.subcontractor.assign',
    'project.performance.read',
    'project.material_request.read', 'project.material_request.create', 'project.material_request.update', 'project.material_request.submit', 'project.material_request.cancel',
    'project.quote.read', 'project.quote.create', 'project.quote.update', 'project.quote.submit', 'project.quote.accept', 'project.quote.reject',
    'project.purchase_order.read', 'project.purchase_order.create', 'project.purchase_order.update', 'project.purchase_order.submit', 'project.purchase_order.approve', 'project.purchase_order.send', 'project.purchase_order.cancel',
    'project.procurement_approval.read', 'project.procurement_approval.create', 'project.procurement_approval.approve', 'project.procurement_approval.reject',
    'project.committed_cost.read',
    'project.delivery.read', 'project.delivery.create', 'project.delivery.update',
    'project.receipt.read', 'project.receipt.create', 'project.receipt.post', 'project.receipt.void',
    'project.inventory.read', 'project.inventory.adjust',
  ],
  'Finance': [
    'organization:read', 'member:read',
    'project:read', 'task:update:own',
    'document:read', 'payment:approve', 'billing:read',
    'ai.runs.create', 'ai.runs.read', 'ai.runs.cancel', 'ai.approvals.decide',
    'supplier:read', 'material:read',
    'project.field-log.read',
    'project.issue.read', 'project.issue.update',
    'project.task.read',
    'project.baseline.read',
    'project.material_request.read',
    'project.quote.read',
    'project.purchase_order.read', 'project.purchase_order.approve',
    'project.procurement_approval.read', 'project.procurement_approval.approve', 'project.procurement_approval.reject',
    'project.committed_cost.read',
    'project.delivery.read',
    'project.receipt.read',
    'project.inventory.read',
  ],
  'Procurement': [
    'organization:read', 'member:read',
    'project:read',
    'document:read', 'document:upload',
    'change_order:approve',
    'supplier:read', 'supplier:create', 'supplier:update',
    'material:read', 'material:create', 'material:update',
    'project.field-log.read',
    'project.issue.read',
    'project.material_request.read', 'project.material_request.create', 'project.material_request.update', 'project.material_request.submit', 'project.material_request.cancel',
    'project.quote.read', 'project.quote.create', 'project.quote.update', 'project.quote.submit', 'project.quote.accept', 'project.quote.reject',
    'project.purchase_order.read', 'project.purchase_order.create', 'project.purchase_order.update', 'project.purchase_order.submit', 'project.purchase_order.send', 'project.purchase_order.cancel',
    'project.procurement_approval.read', 'project.procurement_approval.create',
    'project.committed_cost.read',
    'project.delivery.read', 'project.delivery.create', 'project.delivery.update',
    'project.receipt.read', 'project.receipt.create', 'project.receipt.post',
    'project.inventory.read', 'project.inventory.adjust',
  ],
  'Site Supervisor': [
    'organization:read', 'member:read',
    'project:read',
    'task:create', 'task:update',
    'document:read', 'document:upload',
    'project.task.read', 'project.task.create', 'project.task.update',
    'project.baseline.read',
    'project.field-log.read', 'project.field-log.create', 'project.field-log.update', 'project.field-log.submit',
    'project.issue.read', 'project.issue.create', 'project.issue.update', 'project.issue.transition',
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
