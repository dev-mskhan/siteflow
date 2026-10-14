/**
 * AcceptInvitationPage — /invitations/:token
 *
 * Handles the invitation email link. Three scenarios:
 *
 * A) User is not logged in
 *    → Show "You need an account to accept this invitation"
 *    → Two CTAs: "Create account" (→ /register?invite=<token>)
 *                "Sign in"        (→ /login?invite=<token>)
 *    → After auth, LoginPage/RegisterPage reads ?invite= and
 *      redirects back here to complete acceptance.
 *
 * B) User is logged in, invitation is valid
 *    → Auto-calls POST /invitations/:token/accept
 *    → On success → /dashboard (org context will be set by onboarding module later)
 *
 * C) Token expired / already accepted / wrong user
 *    → Inline error with clear explanation
 *
 * Note: The actual POST /invitations/:token/accept endpoint lives under
 * the invitation module. We add a minimal endpoint call here without
 * a separate invitationApi file (that belongs to the org module phase).
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useAuth } from '../../features/auth/useAuth';
import { baseApi } from '../../services/baseApi';
import { useAppDispatch, useAppSelector } from '../../app/store';
import { useToast } from '../../components/ui/Toast';

type PageState = 'idle' | 'accepting' | 'success' | 'error';

export const AcceptInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized, user } = useAuth();
  const { error: toastErr } = useToast();

  const [pageState, setPageState] = useState<PageState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Once auth is initialized and user is logged in, auto-accept
  useEffect(() => {
    if (!isInitialized || !token) return;
    if (!isAuthenticated) return; // show the login prompt instead

    const accept = async () => {
      setPageState('accepting');
      try {
        // Direct fetch — invitation module hasn't been built yet.
        // When the invitationApi is added, replace this with the RTK mutation.
        const apiBase =
          (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';
        const res = await fetch(`${apiBase}/invitations/${token}/accept`, {
          method: 'POST',
          credentials: 'include',
        });
        const body = await res.json() as { success: boolean; error?: { code: string; message: string } };

        if (!res.ok || !body.success) {
          setErrorMsg(body.error?.message ?? 'This invitation is invalid, expired, or has already been accepted.');
          setPageState('error');
          return;
        }

        setPageState('success');
        // Invalidate org cache so the new org appears after redirect
        dispatch(baseApi.util.invalidateTags(['Organization']));
        setTimeout(() => navigate('/dashboard', { replace: true }), 1600);
      } catch {
        setErrorMsg('Could not connect to the server. Please check your connection and try again.');
        setPageState('error');
      }
    };

    accept();
  }, [isInitialized, isAuthenticated, token, navigate, dispatch]);

  if (!isInitialized) {
    return (
      <AuthLayout showPanel={false}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
        </div>
      </AuthLayout>
    );
  }

  // ── Authenticated states ─────────────────────────────────────────────────
  if (isAuthenticated) {
    return (
      <AuthLayout showPanel={false}>
        <div className="flex flex-col items-center text-center gap-6 py-8">
          {pageState === 'accepting' && (
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
                The invitation may have expired or already been used. Ask your administrator to
                send a new one.
              </p>
              <Link
                to="/dashboard"
                className="block text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                Go to dashboard →
              </Link>
            </div>
          )}
        </div>
      </AuthLayout>
    );
  }

  // ── Not authenticated — prompt to sign in / register ─────────────────────
  return (
    <AuthLayout
      headline={
        <>
          You've been{' '}
          <em className="font-serif font-light not-italic italic">invited</em>.
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
