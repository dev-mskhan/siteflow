import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

const BYPASS = import.meta.env.VITE_DEV_BYPASS === 'true';

// In bypass mode — always pass through (you'd never visit /login in test mode anyway).
const RequireGuestBypass: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

const RequireGuestReal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isInitialized, user } = useAuth();

  if (!isInitialized) return null;
  if (isAuthenticated) {
    if (user && !user.emailVerified) return <Navigate to="/verify-email/pending" replace />;
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

export const RequireGuest: React.FC<{ children: React.ReactNode }> = BYPASS
  ? RequireGuestBypass
  : RequireGuestReal;
