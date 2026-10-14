/**
 * AcceptInvitationPage — /invitations/:token
 *
 * A) Not logged in  → prompt to register or sign in
 * B) Logged in      → auto-calls POST /invitations/:token/accept via RTK mutation
 * C) Error          → inline error with admin contact prompt
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useAuth } from '../../features/auth/useAuth';
import { useAcceptInvitationMutation } from '../../features/org/invitationApi';
import { baseApi } from '../../services/baseApi';
import { useAppDispatch } from '../../app/store';
import { getServerError } from '../../lib/authErrors';

type PageState = 'idle' | 'accepting' | 'success' | 'error';

export const AcceptInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized } = useAuth();

  const [pageState, setPageState] = useState<PageState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [acceptInvitation] = useAcceptInvitationMutation();

  useEffect(() => {
    if (!isInitialized || !token || !isAuthenticated) return;

    const accept = async () => {
      setPageState('accepting');
      try {
        await acceptInvitation(token).unwrap();
        setPageState('success');
        // Invalidate org list so the new org appears in OnboardingRouter
        dispatch(baseApi.util.invalidateTags(['Organization']));
        setTimeout(() => navigate('/onboarding', { replace: true }), 1600);
      } catch (err: unknown) {
        const serverErr = getServerError(err as Parameters<typeof getServerError>[0]);
        setErrorMsg(
          serverErr?.message ??
            'This invitation is invalid, expired, or has already been accepted.',
        );
        setPageState('error');
      }
    };

    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isAuthenticated, token]);

  // ── Auth not settled yet ───────────────────────────────────────────────────
  if (!isInitialized) {
    return (
      <AuthLayout showPanel={false}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
        </div>
      </AuthLayout>
    );
  }

  // ── Authenticated — show acceptance states ─────────────────────────────────
  if (isAuthenticated) {
    return (
      <AuthLayout showPanel={false}>
        <div className="flex flex-col items-center text-center gap-6 py-8">
          {(pageState === 'idle' || pageState === 'accepting') && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
              <p className="text-sm text-[var(--muted)]">Accepting your invitation…</p>
            </>
          )}

          {pageState === 'success' && (
            <>
              <div className="flex h-14 w-14 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
                <CheckCircle2 className="h-7 w-7 text-[#166534]" strokeWidth={1.6} />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Invitation accepted
                </p>
                <h1 className="mt-2 text-xl font-medium tracking-[-0.03em]">You're in</h1>
                <p className="mt-2 text-sm text-[var(--muted)]">Redirecting to your workspace…</p>
              </div>
            </>
          )}

          {pageState === 'error' && (
            <div className="w-full max-w-sm space-y-4">
              <InlineAlert variant="error" title="Could not accept invitation" message={errorMsg} />
              <p className="text-sm text-[var(--muted)]">
                The invitation may have expired or already been used. Ask your administrator to send
                a new one.
              </p>
              <Link
                to="/onboarding"
                className="block text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                Go to your workspaces →
              </Link>
            </div>
          )}
        </div>
      </AuthLayout>
    );
  }

  // ── Not authenticated — prompt ─────────────────────────────────────────────
  return (
    <AuthLayout
      headline={
        <>
          You've been <em className="font-serif font-light not-italic italic">invited</em>.
        </>
      }
      subline="Sign in or create an account to join your team's SiteFlow workspace."
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
            <Mail className="h-5 w-5 text-[var(--ink)]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Team invitation
            </p>
            <h1 className="text-xl font-medium tracking-[-0.03em]">Accept your invitation</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Sign in or create a free account to join your team's workspace.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            to={`/register?invite=${token}`}
            className="flex w-full items-center justify-center gap-2 min-h-11 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
          >
            Create a free account
          </Link>
          <Link
            to={`/login?invite=${token}`}
            className="flex w-full items-center justify-center gap-2 min-h-11 border border-[var(--hairline-2)] bg-[var(--paper)] px-5 text-sm font-medium transition-colors hover:border-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
          >
            Sign in to existing account
          </Link>
        </div>

        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
          Invitation links expire after 7 days.
        </p>
      </div>
    </AuthLayout>
  );
};
