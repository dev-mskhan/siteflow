/**
 * ForgotPasswordPage — email entry for password reset.
 *
 * Server always returns 200 regardless of whether email exists (enumeration prevention).
 * So after submit we always show the generic "check your inbox" copy.
 * Only 429 and 500 cause an actual error state — both shown as toasts.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@siteflow/shared';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { FormField, inputCls } from '../../components/ui/FormField';
import { useForgotPasswordMutation } from '../../features/auth/authApi';
import { isToastError, toastErrorMessage } from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';

export const ForgotPasswordPage: React.FC = () => {
  const { error: toastErr } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const [forgotPassword, { isLoading, error }] = useForgotPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  // Toast for rate limit and server errors only
  useEffect(() => {
    if (error && isToastError(error)) {
      toastErr('Request failed', toastErrorMessage(error));
    }
  }, [error, toastErr]);

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      await forgotPassword(data).unwrap();
      // Always show success — server never leaks whether email exists
      setSubmittedEmail(data.email);
      setSubmitted(true);
    } catch {
      // Toast handler above fires for 429/500
    }
  };

  return (
    <AuthLayout showPanel={false}>
      {!submitted ? (
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Password reset
            </p>
            <h1 className="text-2xl font-medium tracking-[-0.04em]">Forgot your password?</h1>
            <p className="text-sm text-[var(--muted)]">
              Enter your email and we'll send a reset link if an account exists.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <FormField label="Work email" error={errors.email?.message} required>
              {(id) => (
                <input
                  id={id}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={inputCls(!!errors.email)}
                  {...register('email')}
                />
              )}
            </FormField>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 min-h-11 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {isLoading ? 'Sending…' : 'Send reset link'}
              {!isLoading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--muted)]">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        /* ── Sent confirmation ──────────────────────────────────────── */
        <div className="space-y-6">
          <div className="flex h-14 w-14 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
            <CheckCircle2 className="h-7 w-7 text-[#166534]" strokeWidth={1.6} />
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Check your inbox
            </p>
            <h1 className="text-xl font-medium tracking-[-0.03em]">Reset link sent</h1>
            <p className="text-sm leading-6 text-[var(--muted)]">
              If an account exists for{' '}
              <span className="font-medium text-[var(--ink)]">{submittedEmail}</span>, you will
              receive a password reset link. The link expires in 1 hour.
            </p>
          </div>

          <div className="border-t border-[var(--hairline-2)] pt-6 space-y-2">
            <p className="text-sm text-[var(--muted)]">Didn't receive it?</p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
            >
              Try a different email
            </button>
          </div>

          <Link
            to="/login"
            className="block text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  );
};
