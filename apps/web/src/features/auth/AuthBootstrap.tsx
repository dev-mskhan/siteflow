import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useGetMeQuery } from './authApi';
import { useAppDispatch } from '../../app/store';
import { authUserLoaded, authInitializedEmpty } from './authSlice';

interface AuthBootstrapProps {
  children: React.ReactNode;
}

// ── Real bootstrap — calls GET /auth/me, populates authSlice ──────────────────
const AuthBootstrapReal: React.FC<AuthBootstrapProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { data, isLoading, isError, isSuccess } = useGetMeQuery();

  useEffect(() => {
    if (isSuccess && data?.user) dispatch(authUserLoaded(data.user));
    if (isError) dispatch(authInitializedEmpty());
  }, [isSuccess, isError, data, dispatch]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--surface)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
      </div>
    );
  }

  return <>{children}</>;
};

// ── Bypass bootstrap — preloadedState already has isInitialized:true ──────────
// Render children immediately. No network call, no spinner, no re-dispatch.
const AuthBootstrapBypass: React.FC<AuthBootstrapProps> = ({ children }) => <>{children}</>;

const BYPASS = import.meta.env.VITE_DEV_BYPASS === 'true';

export const AuthBootstrap: React.FC<AuthBootstrapProps> = BYPASS
  ? AuthBootstrapBypass
  : AuthBootstrapReal;
