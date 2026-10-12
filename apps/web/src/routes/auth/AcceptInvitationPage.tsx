/**
 * AcceptInvitationPage — /accept-invitation?token=...
 *
 * Allows invited team members to accept an organization invitation.
 * Contract: POST /api/v1/invitations/:token/accept (authenticated).
 * If user is not logged in, guides them to sign in or register first.
 */

import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useGetMeQuery, useAcceptInvitationMutation } from '../../features/auth/api/authApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { extractErrorMessage } from '../../lib/utils/index';
import { useToast } from '../../components/ui/Toast';

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const { data: user, isLoading: isCheckingAuth } = useGetMeQuery();
  const [acceptInvitation, { isLoading: isAccepting }] = useAcceptInvitationMutation();
  const { success: toastSuccess, error: toastError } = useToast();
  const [apiError, setApiError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!token) return;
    setApiError(null);
    try {
      const res = await acceptInvitation(token).unwrap();
      toastSuccess('Invitation Accepted', `Welcome to the workspace! Role: ${res.roleName}`);
      navigate('/projects', { replace: true });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setApiError(msg);
      toastError('Failed to accept invitation', msg);
    }
  };

  if (!token) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardContent className="py-10 space-y-4">
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)' }}
          >
            ✕
          </div>
          <h2 className="text-xl font-bold text-text">Invalid Invitation Link</h2>
          <p className="text-sm text-text-muted">
            The invitation token is missing from the URL. Please request a new invitation from your administrator.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => navigate('/login')}>
            Go to Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center bg-gradient-brand text-white text-xl font-black mb-2">
          SF
        </div>
        <CardTitle>Workspace Invitation</CardTitle>
        <CardDescription>
          You have been invited to join an organization workspace on SiteFlow.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {apiError && (
          <div
            role="alert"
            className="px-4 py-3 rounded-xl text-sm border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
            }}
          >
            {apiError}
          </div>
        )}

        {!isCheckingAuth && !user ? (
          <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3 text-center">
            <p className="text-sm text-text-muted">
              You must be signed in to accept this invitation.
            </p>
            <div className="flex gap-2 justify-center">
              <Link to={`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`}>
                <Button variant="primary" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to={`/register?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`}>
                <Button variant="secondary" size="sm">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-2">
            <p className="text-xs text-text-muted">Signed in as:</p>
            <p className="text-sm font-semibold text-text">
              {user?.firstName} {user?.lastName} ({user?.email})
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-3">
        {user && (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleAccept}
            isLoading={isAccepting}
            disabled={isAccepting}
          >
            Accept & Join Workspace
          </Button>
        )}
        <p className="text-xs text-center text-text-muted">
          Need assistance?{' '}
          <Link to="/contact" className="text-accent-1 hover:underline">
            Contact support
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
