/**
 * AuthBridge
 *
 * Fires GET /auth/me on app mount (via RTK Query).
 * Keeps the auth session warm and handles 401 → clear state.
 * Does NOT render anything visible — purely a session lifecycle manager.
 *
 * Business rules from docs/api/remaining-modules.md:
 *  - GET /auth/me returns { user: UserDTO }
 *  - 401 → cookies expired or invalid, treat as unauthenticated
 */

import { type ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGetMeQuery } from '../api/authApi';

const PUBLIC_PATHS = new Set([
  '/',
  '/features',
  '/pricing',
  '/about',
  '/contact',
  '/blog',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/trial',
  '/accept-invitation',
  '/auth/complete',
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Check prefix matches like /blog/...
  return pathname.startsWith('/blog/') || pathname.startsWith('/auth/');
}

interface AuthBridgeProps {
  children: ReactNode;
}

export function AuthBridge({ children }: AuthBridgeProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const { isLoading, isError } = useGetMeQuery(undefined, {
    // Poll silently every 4 minutes to keep session alive
    pollingInterval: 4 * 60 * 1000,
  });

  useEffect(() => {
    // If /auth/me returns 401 and we're on a protected path, redirect to login
    if (isError && !isPublicPath(location.pathname)) {
      navigate('/login', {
        replace: true,
        state: { from: location },
      });
    }
  }, [isError, location, navigate]);

  // Don't block render for public pages
  if (isLoading && !isPublicPath(location.pathname)) {
    // Render nothing while checking session on protected routes
    // AppLayout handles the visual loading state
    return null;
  }

  return <>{children}</>;
}
