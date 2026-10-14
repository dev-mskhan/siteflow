/**
 * RequireGuest — wraps auth screens (login, register, etc.).
 * If the user is already authenticated and verified, redirect to /dashboard.
 * If authenticated but unverified, send to /verify-email/pending.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

export const RequireGuest: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isInitialized, user } = useAuth();

  if (!isInitialized) return null;

  if (isAuthenticated) {
    if (user && !user.emailVerified) {
      return <Navigate to="/verify-email/pending" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
