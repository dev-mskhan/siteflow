import { useAppSelector } from '../../app/store';

/**
 * Primary auth selector hook used throughout the app.
 * Reads from authSlice — populated by AuthBootstrap on mount.
 */
export function useAuth() {
  const { user, isAuthenticated, isInitialized, sessionExpired } = useAppSelector(
    (s) => s.auth,
  );
  return { user, isAuthenticated, isInitialized, sessionExpired };
}
