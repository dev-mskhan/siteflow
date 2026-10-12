/**
 * AuthCompletePage — /auth/complete
 *
 * Destination of Google OAuth redirect from the Fastify server.
 * The server sets httpOnly cookies (access_token, refresh_token)
 * and redirects here.
 *
 * This page uses RTK Query useGetMeQuery to fetch the newly authenticated
 * user and redirects to /projects or /dashboard.
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGetMeQuery } from '../../features/auth/api/authApi';
import { Card, CardContent } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';

export default function AuthCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user, isLoading, isError, refetch } = useGetMeQuery(undefined, {
    // Force a fresh check of the cookies just set by backend
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/projects';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  return (
    <Card className="w-full max-w-md text-center">
      <CardContent className="py-12 space-y-4">
        {isLoading && (
          <>
            <LoadingSpinner size="lg" />
            <h2 className="text-lg font-bold text-text">Completing Authentication</h2>
            <p className="text-xs text-text-muted">
              Synchronizing credentials and workspace permissions...
            </p>
          </>
        )}

        {isError && (
          <div className="space-y-4">
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)' }}
            >
              ✕
            </div>
            <h2 className="text-lg font-bold text-danger">Authentication Error</h2>
            <p className="text-xs text-text-muted">
              Could not verify OAuth credentials. Your session may have timed out.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/login', { replace: true })}>
                Back to Sign In
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
