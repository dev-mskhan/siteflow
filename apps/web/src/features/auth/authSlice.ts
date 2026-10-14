import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserDTO } from '@siteflow/shared';

// ─── State shape ──────────────────────────────────────────────────────────────

interface AuthState {
  user: UserDTO | null;
  /**
   * Whether the user currently has a valid session.
   * Derived from /auth/me resolution — not from cookie presence.
   */
  isAuthenticated: boolean;
  /**
   * True until the first GET /auth/me settles (fulfilled or rejected).
   * Used by AuthBootstrap to show a loading screen before any routing.
   */
  isInitialized: boolean;
  /**
   * Fallback Bearer token (stored only when server sends it explicitly).
   * Normally null — auth is cookie-based.
   */
  accessToken: string | null;
  /**
   * Set true when a 401 slips through refresh (session truly expired).
   * Triggers redirect to /login from AuthBootstrap.
   */
  sessionExpired: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  accessToken: null,
  sessionExpired: false,
};

// ─── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Called by baseQueryWithReauth when refresh token is also expired
    authSessionExpired: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.sessionExpired = true;
    },
    // Called by components after they've handled the redirect
    authSessionExpiredAcknowledged: (state) => {
      state.sessionExpired = false;
    },
    // Hydrate user directly (e.g. from /auth/me response in AuthBootstrap)
    authUserLoaded: (state, action: PayloadAction<UserDTO>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isInitialized = true;
      state.sessionExpired = false;
    },
    // Full clear — used on logout
    authCleared: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
      state.accessToken = null;
      state.sessionExpired = false;
    },
    // Mark initialized without a user (no valid session)
    authInitializedEmpty: (state) => {
      state.isInitialized = true;
      state.isAuthenticated = false;
      state.user = null;
    },
  },
});

export const {
  authSessionExpired,
  authSessionExpiredAcknowledged,
  authUserLoaded,
  authCleared,
  authInitializedEmpty,
} = authSlice.actions;

export default authSlice.reducer;
