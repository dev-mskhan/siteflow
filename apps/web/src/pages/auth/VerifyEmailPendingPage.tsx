/**
 * VerifyEmailPendingPage — shown after registration and whenever
 * the user hits a route that requires emailVerified: true.
 *
 * Lets the user:
 *  - See which email they need to check
 *  - Resend the verification email (rate-limited to 3 per 15 min server-side)
 *  - Sign out and try a different account
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailOpen, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resendVerificationSchema, type ResendVerificationInput } from '@siteflow/shared';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useResendVerificationMutation, useLogoutMutation } from '../../features/auth/authApi';
import { useAppDispatch } from '../../app/store';
import { authCleared } from '../../features/auth/authSlice';
import { useAuth } from '../../features/auth/useAuth';
import { isToastError, toastErrorMessage } from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';

export const VerifyEmailPendingPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { error: toastErr, success: toastSuccess } = useToast();
  const [resentOk, setResentOk] = useState(false);

  const [resend, { isLoading: resending }] = useResendVerificationMutation();
  const [logout] = useLogoutMutation();

  const { handleSubmit } = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: user?.email ?? '' },
  });

  const handleResend = async () => {
    if (!user?.email) return;
    try {
      await resend({ email: user.email }).unwrap();
      // Server always returns 200 regardless — show generic success copy
      setResentOk(true);
      toastSuccess('Email sent', 'Check your inbox for a new verification link.');
    } catch (err: unknown) {
      // Only 429 and 500 can actually error here
      if (isToastError(err as Parameters<typeof isToastError>[0])) {
        toastErr('Could not resend', toastErrorMessage(err as Parameters<typeof toastErrorMessage>[0]));
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(authCleared());
      navigate('/login', { replace: true });
    }
  };

  return (
    <AuthLayout showPanel={false}>
      <div className="space-y-8">
        {/* Icon */}
        <div className="flex h-14 w-14 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
          <MailOpen className="h-7 w-7 text-[var(--ink)]" strokeWidth={1.5} />
        </div>

        {/* Copy */}
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            One more step
          </p>
          <h1 className="text-2xl font-medium tracking-[-0.04em]">Check your inbox</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            We sent a verification link to{' '}
            <span className="font-medium text-[var(--ink)]">{user?.email ?? 'your email'}</span>.
            Click the link in that email to confirm your address and set up your workspace.
          </p>
        </div>

        {/* Resent confirmation */}
        {resentOk && (
          <InlineAlert
            variant="success"
            message="A new verification link has been sent. Please check your inbox (and spam folder)."
            onDismiss={() => setResentOk(false)}
          />
        )}

        {/* Divider */}
        <div className="border-t border-[var(--hairline-2)] pt-6 space-y-3">
          <p className="text-sm text-[var(--muted)]">Didn't receive the email?</p>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resentOk}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} strokeWidth={2} />
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>

          <div className="pt-1">
            <p className="text-sm text-[var(--muted)]">
              Wrong email address?{' '}
              <button
                type="button"
                onClick={handleSignOut}
                className="font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                Sign out and try again
              </button>
            </p>
          </div>
        </div>

        {/* Help text */}
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] leading-relaxed">
          The verification link expires after 24 hours. Up to 3 resend requests are allowed per 15-minute window.
        </p>
      </div>
    </AuthLayout>
  );
};
