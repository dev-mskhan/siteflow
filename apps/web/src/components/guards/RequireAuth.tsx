/**
 * RequireAuth — protects any route that needs a valid session.
 *
 * Redirects to /login preserving the intended destination in location.state.from
 * so LoginPage can send the user back after a successful sign-in.
 *
 * Also enforces the email-verification gate:
 * If authenticated but email not verified → /verify-email/pending
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

interface RequireAuthProps {
  children: React.ReactNode;
  /** Set true to skip the emailVerified check (used on /verify-email/pending itself) */
  allowUnverified?: boolean;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  allowUnverified = false,
}) => {
  const { isAuthenticated, isInitialized, user } = useAuth();
  const location = useLocation();

  // AuthBootstrap hasn't settled yet — render nothing (it shows its own spinner)
  if (!isInitialized) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowUnverified && user && !user.emailVerified) {
    return <Navigate to="/verify-email/pending" replace />;
  }

  return <>{children}</>;
};
