/**
 * lib/auth/index — backwards-compat re-export
 *
 * Auth state is now managed by RTK Query (useGetMeQuery).
 * Import useAuth from features/auth/hooks/useAuth instead.
 */

export { useAuth } from '../../features/auth/hooks/useAuth';

// Keep AuthContextType for any legacy consumers during migration
export interface AuthContextType {
  user: import('@siteflow/shared').UserDTO | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: import('@siteflow/shared').LoginInput) => Promise<import('@siteflow/shared').UserDTO>;
  register: (data: import('@siteflow/shared').RegisterInput) => Promise<import('@siteflow/shared').UserDTO>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}
