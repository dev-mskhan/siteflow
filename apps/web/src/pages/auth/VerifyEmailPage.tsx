/**
 * VerifyEmailPage — handles the ?token= link from the verification email.
 *
 * Behavior:
 *  1. On mount, reads ?token= from URL and auto-submits to /auth/verify-email.
 *  2. On success → shows confirmation, then routes to post-login flow.
 *  3. On error (400 expired/used) → shows inline error + link to resend.
 *  4. If no token in URL → redirects to /verify-email/pending.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useVerifyEmailMutation } from '../../features/auth/authApi';
import { useAppDispatch } from '../../app/store';
import { authUserLoaded } from '../../features/auth/authSlice';
import { useAuth } from '../../features/auth/useAuth';
import { getServerError } from '../../lib/authErrors';
import { useGetMeQuery } from '../../features/auth/authApi';

type VerifyState = 'verifying' | 'success' | 'error';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const token = searchParams.get('token');

  const [verifyState, setVerifyState] = useState<VerifyState>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  const [verifyEmail] = useVerifyEmailMutation();
  // Re-fetch /me after verification so emailVerified flag updates in Redux
  const { refetch: refetchMe } = useGetMeQuery(undefined, { skip: verifyState !== 'success' });

  useEffect(() => {
    if (!token) {
      navigate('/verify-email/pending', { replace: true });
      return;
    }

    const run = async () => {
      try {
        await verifyEmail({ token }).unwrap();
        setVerifyState('success');
        // Refresh user in Redux so emailVerified: true
        const result = await refetchMe();
        if (result.data?.user) {
          dispatch(authUserLoaded(result.data.user));
        }
        // Small delay so user can see the success state before being routed on
        setTimeout(() => {
          navigate('/onboarding', { replace: true });
        }, 1800);
      } catch (err: unknown) {
        setVerifyState('error');
        const serverErr = getServerError(err as Parameters<typeof getServerError>[0]);
        setErrorMessage(
          serverErr?.message ?? 'This verification link is invalid, expired, or has already been used.',
        );
      }
    };

    run();
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthLayout showPanel={false}>
      <div className="flex flex-col items-center text-center space-y-6 py-10">
        {verifyState === 'verifying' && (
          <>
            <Loader2 className="h-10 w-10 text-[var(--muted)] animate-spin" strokeWidth={1.5} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Please wait
              </p>
              <h1 className="mt-2 text-xl font-medium tracking-[-0.03em]">
                Verifying your email…
              </h1>
            </div>
          </>
        )}

        {verifyState === 'success' && (
          <>
            <div className="flex h-14 w-14 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
              <CheckCircle2 className="h-7 w-7 text-[#166534]" strokeWidth={1.6} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Verified
              </p>
              <h1 className="mt-2 text-xl font-medium tracking-[-0.03em]">
                Email confirmed
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Redirecting you to set up your workspace…
              </p>
            </div>
          </>
        )}

        {verifyState === 'error' && (
          <>
            <div className="flex h-14 w-14 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
              <XCircle className="h-7 w-7 text-[#991b1b]" strokeWidth={1.6} />
            </div>
            <div className="w-full max-w-sm space-y-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Verification failed
                </p>
                <h1 className="mt-2 text-xl font-medium tracking-[-0.03em]">
                  Link not valid
                </h1>
              </div>
              <InlineAlert variant="error" message={errorMessage} />
              <p className="text-sm text-[var(--muted)]">
                Need a new link?{' '}
                <Link
                  to="/verify-email/pending"
                  className="font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
                >
                  Request another
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
};
