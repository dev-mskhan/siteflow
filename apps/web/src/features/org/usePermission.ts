import { useOrgContext } from './useOrgContext';
import type { PermissionKey } from '../../lib/permissions';

/** Returns true if the current membership has the given permission. */
export function usePermission(key: PermissionKey): boolean {
  const { permissions } = useOrgContext();
  return permissions.includes(key);
}

/** Returns true if the current membership has ALL of the given permissions. */
export function usePermissions(keys: PermissionKey[]): boolean {
  const { permissions } = useOrgContext();
  return keys.every((k) => permissions.includes(k));
}
