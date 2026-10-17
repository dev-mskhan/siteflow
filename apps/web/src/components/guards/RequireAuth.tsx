import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

interface RequireAuthProps {
  children: React.ReactNode;
  allowUnverified?: boolean;
}

const BYPASS = import.meta.env.VITE_DEV_BYPASS === 'true';

// In bypass mode — always pass through. preloadedState has a verified user.
const RequireAuthBypass: React.FC<RequireAuthProps> = ({ children }) => <>{children}</>;

const RequireAuthReal: React.FC<RequireAuthProps> = ({ children, allowUnverified = false }) => {
  const { isAuthenticated, isInitialized, user } = useAuth();
  const location = useLocation();

  if (!isInitialized) return null;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!allowUnverified && user && !user.emailVerified) {
    return <Navigate to="/verify-email/pending" replace />;
  }
  return <>{children}</>;
};

export const RequireAuth: React.FC<RequireAuthProps> = BYPASS ? RequireAuthBypass : RequireAuthReal;
