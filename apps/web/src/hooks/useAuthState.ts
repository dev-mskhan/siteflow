/**
 * useAuthState — auth stub for the marketing site.
 *
 * Currently reads `access_token` from localStorage as a presence check.
 * When the real auth flow (signup → org onboarding → dashboard) is wired,
 * this hook will be replaced with a proper context + token validation call.
 *
 * Returns:
 *  isLoggedIn  — true if a token exists (NOT cryptographically verified here)
 *  isLoading   — true for the first render tick while localStorage is read
 *
 * Usage in components:
 *   const { isLoggedIn, isLoading } = useAuthState();
 *   if (isLoggedIn) → show "Open dashboard", else → show "Get started"
 *
 * The hook also listens for the 'storage' event so multiple tabs stay in sync.
 */

import { useEffect, useState } from 'react';

const TOKEN_KEY = 'access_token';

function readToken(): boolean {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    // localStorage blocked (e.g. private mode on some browsers)
    return false;
  }
}

export interface AuthState {
  isLoggedIn: boolean;
  /** True only on the very first render before localStorage has been read */
  isLoading: boolean;
}

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ isLoggedIn: false, isLoading: true });

  useEffect(() => {
    // Initial read
    setState({ isLoggedIn: readToken(), isLoading: false });

    // Cross-tab sync: if another tab logs in or out, reflect it here
    const handler = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === null) {
        setState({ isLoggedIn: readToken(), isLoading: false });
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return state;
}
