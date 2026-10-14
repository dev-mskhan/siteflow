/**
 * useAuthState — backwards-compatible wrapper used by the Navbar
 * and other marketing-site components.
 *
 * Delegates to the Redux auth slice (populated by AuthBootstrap).
 * The interface is identical to the old localStorage stub so no
 * consumers need to change.
 */
import { useAuth } from '../features/auth/useAuth';

export interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
}

export function useAuthState(): AuthState {
  const { isAuthenticated, isInitialized } = useAuth();
  return {
    isLoggedIn: isAuthenticated,
    isLoading: !isInitialized,
  };
}
