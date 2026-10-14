/**
 * PermissionGate — hides children when the current membership lacks a permission.
 *
 * This is PURELY cosmetic. The server enforces every permission.
 * Never use this to block navigation — only to hide actions.
 *
 * Usage:
 *   <PermissionGate require="member:invite">
 *     <InviteButton />
 *   </PermissionGate>
 *
 *   <PermissionGate require="audit:read" fallback={<NoAccessBanner />}>
 *     <AuditLogTable />
 *   </PermissionGate>
 */
import React from 'react';
import { usePermission } from '../../features/org/usePermission';
import type { PermissionKey } from '../../lib/permissions';

interface PermissionGateProps {
  require: PermissionKey;
  children: React.ReactNode;
  /** Rendered when permission is absent. Defaults to null. */
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  require: key,
  children,
  fallback = null,
}) => {
  const allowed = usePermission(key);
  return <>{allowed ? children : fallback}</>;
};
