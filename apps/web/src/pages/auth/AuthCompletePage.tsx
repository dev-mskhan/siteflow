/**
 * AuthCompletePage — landing page after Google OAuth redirect.
 *
 * Flow:
 *  Server → sets HttpOnly cookies → redirects to /auth/complete
 *  This page → calls GET /auth/me → loads user into Redux → routes onward.
 *
 * Post-route decision:
 *  - No valid session    → /login (cookies missing or expired)
 *  - Email unverified   → /verify-email/pending
 *  - No org             → /onboarding/create-org   (handled by OnboardingRouter)
 *  - Has org            → /dashboard
 *
 * Error param: server may append ?error=access_denied etc.
 */

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useGetMeQuery } from '../../features/auth/authApi';
import { useAppDispatch } from '../../app/store';
import { authUserLoaded, authInitializedEmpty } from '../../features/auth/authSlice';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You cancelled the Google sign-in. Please try again.',
  server_error: 'Google returned an error. Please try again.',
  state_mismatch: 'Sign-in was interrupted. Please try again.',
  default: 'Something went wrong with Google sign-in. Please try again.',
};

export const AuthCompletePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  const oauthError = searchParams.get('error');
  const errorMessage = oauthError
    ? (OAUTH_ERROR_MESSAGES[oauthError] ?? OAUTH_ERROR_MESSAGES.default)
    : null;

  // Fetch /me — the HttpOnly cookie the server set is sent automatically
  const { data, isLoading, isError } = useGetMeQuery(undefined, {
    skip: !!oauthError, // Don't bother if OAuth itself failed
  });

  useEffect(() => {
    if (oauthError) return;

    if (data?.user) {
      dispatch(authUserLoaded(data.user));

      if (!data.user.emailVerified) {
        navigate('/verify-email/pending', { replace: true });
        return;
      }
      // OnboardingRouter will redirect to /onboarding/create-org if no org exists
      navigate('/onboarding', { replace: true });
    }

    if (isError) {
      dispatch(authInitializedEmpty());
      navigate('/login', { replace: true });
    }
  }, [data, isError, oauthError, navigate, dispatch]);

  return (
    <AuthLayout showPanel={false}>
      <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
        {errorMessage ? (
          <div className="w-full max-w-sm space-y-4">
            <InlineAlert variant="error" title="Sign-in failed" message={errorMessage} />
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <>
            <Loader2 className="h-8 w-8 text-[var(--muted)] animate-spin" strokeWidth={1.5} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Please wait
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {isLoading ? 'Signing you in…' : 'Redirecting…'}
              </p>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
};
