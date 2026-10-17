/**
 * Permission hooks — re-export from features/org for convenience
 */
export { usePermission, usePermissions } from '../features/org/usePermission';

/** Alias for usePermission — common naming pattern */
export { usePermission as useCanAccess } from '../features/org/usePermission';
