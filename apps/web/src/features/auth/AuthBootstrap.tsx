/**
 * AuthBootstrap — calls GET /auth/me on every cold mount.
 *
 * Sits at the root of the app inside <Provider>. Shows a full-page
 * loading screen for the single tick before the first /me call settles.
 * After that the auth state is in Redux and every component reads it
 * from useAuth() without triggering another network call.
 *
 * The silent refresh loop lives in baseQueryWithReauth — no extra
 * polling needed here.
 */

import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useGetMeQuery } from './authApi';
import { useAppDispatch } from '../../app/store';
import { authUserLoaded, authInitializedEmpty } from './authSlice';

interface AuthBootstrapProps {
  children: React.ReactNode;
}

export const AuthBootstrap: React.FC<AuthBootstrapProps> = ({ children }) => {
  const dispatch = useAppDispatch();

  const { data, isLoading, isError, isSuccess } = useGetMeQuery();

  useEffect(() => {
    if (isSuccess && data?.user) {
      dispatch(authUserLoaded(data.user));
    }
    if (isError) {
      // No valid session — mark as initialized so guards can render
      dispatch(authInitializedEmpty());
    }
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
