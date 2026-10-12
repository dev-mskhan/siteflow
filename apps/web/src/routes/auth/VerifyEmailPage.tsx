/**
 * VerifyEmailPage — /verify-email?token=...
 *
 * Fires useVerifyEmailMutation on mount.
 * No form — side-effect on mount only.
 * Three display states: verifying | success | error
 */

import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useVerifyEmailMutation } from '../../features/auth/api/authApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/Skeleton';
import { extractErrorMessage } from '../../lib/utils/index';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [verifyEmail, { isLoading, isSuccess, isError, error }] = useVerifyEmailMutation();

  useEffect(() => {
    if (token) {
      verifyEmail({ token });
    }
  // Run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errorMessage = error ? extractErrorMessage(error) : 'The verification link has expired or has already been used.';

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Email Verification</CardTitle>
        <CardDescription>Validating your email address</CardDescription>
      </CardHeader>

      <CardContent className="py-8">
        {(!token || isLoading) && (
          <div className="space-y-4">
            <LoadingSpinner />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {!token ? 'Missing verification token in URL.' : 'Confirming your email address...'}
            </p>
          </div>
        )}

        {isSuccess && (
          <div className="space-y-4">
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', border: '1px solid var(--success)' }}
            >
              ✓
            </div>
            <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              Email verified!
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Your account is fully activated. Sign in to access your workspace.
            </p>
            <Link to="/login">
              <Button variant="primary" className="w-full mt-2">
                Sign in to your workspace
              </Button>
            </Link>
          </div>
        )}

        {(isError || (!token && !isLoading)) && (
          <div className="space-y-4">
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)' }}
            >
              ✕
            </div>
            <h3 className="text-base font-bold" style={{ color: 'var(--danger)' }}>
              Verification failed
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {errorMessage}
            </p>
            <Link to="/login">
              <Button variant="secondary" className="w-full mt-2">
                Back to Sign In
              </Button>
            </Link>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
        Need help?{' '}
        <Link to="/contact" className="ml-1 hover:opacity-80" style={{ color: 'var(--accent-1)' }}>
          Contact support
        </Link>
      </CardFooter>
    </Card>
  );
}
