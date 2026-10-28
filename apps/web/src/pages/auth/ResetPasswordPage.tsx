/**
 * ResetPasswordPage — reads ?token= from URL, accepts new password.
 *
 * Error handling:
 *  - 400 (expired/used token) → inline alert (the form is the context)
 *  - 422 (validation) → field-level error
 *  - 429 / 500 → toast
 *
 * On success: shows confirmation and links to /login.
 * Note: server revokes ALL sessions on reset (changePasswordTransaction).
 */

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordInput } from '@siteflow/shared';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { FormField } from '../../components/ui/FormField';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useResetPasswordMutation } from '../../features/auth/authApi';
import {
  getFieldValidationErrors,
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { error: toastErr } = useToast();
  const [done, setDone] = useState(false);

  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, newPassword: '' },
  });

  // Toast for 429 / 500
  useEffect(() => {
    if (error && isToastError(error)) {
      toastErr('Reset failed', toastErrorMessage(error));
    }
  }, [error, toastErr]);

  const fieldValidationErrors = getFieldValidationErrors(error);
  const inlineError =
    isInlineError(error) && Object.keys(fieldValidationErrors).length === 0
      ? getServerError(error)
      : null;

  const onSubmit = async (data: ResetPasswordInput) => {
    try {
      await resetPassword(data).unwrap();
      setDone(true);
    } catch (requestError) {
      const fieldError = getFieldValidationErrors(requestError as never).newPassword;
      if (fieldError) setError('newPassword', { type: 'server', message: fieldError });
    }
  };

  if (!token) {
    return (
      <AuthLayout showPanel={false}>
        <InlineAlert
          variant="error"
          title="Invalid link"
          message="This reset link is missing a token. Please request a new password reset."
        />
        <Link
          to="/forgot-password"
          className="mt-4 block text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
        >
          Request new reset link →
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showPanel={false}>
      {!done ? (
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Set new password
            </p>
            <h1 className="text-2xl font-medium tracking-[-0.04em]">Choose a new password</h1>
            <p className="text-sm text-[var(--muted)]">
              Your new password must be at least 8 characters. All active sessions will be signed out.
            </p>
          </div>

          {/* Inline error for expired/used token */}
          {inlineError && (
            <InlineAlert
              variant="error"
              message={inlineError.message}
              title={inlineError.code === 'BAD_REQUEST' ? 'Link expired or already used' : undefined}
            />
          )}

          {inlineError?.code === 'BAD_REQUEST' && (
            <Link
              to="/forgot-password"
              className="block text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
            >
              Request a new reset link →
            </Link>
          )}

          {!inlineError && (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <FormField
                label="New password"
                error={errors.newPassword?.message}
                hint="At least 8 characters"
                required
              >
                {(id, errorId) => (
                  <PasswordInput
                    id={id}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    hasError={!!errors.newPassword}
                    aria-invalid={!!errors.newPassword}
                    aria-describedby={errors.newPassword ? errorId : undefined}
                    {...register('newPassword')}
                  />
                )}
              </FormField>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 min-h-11 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {isLoading ? 'Updating password…' : 'Set new password'}
                {!isLoading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
              </button>
            </form>
          )}
        </div>
      ) : (
        /* ── Success state ──────────────────────────────────────────── */
        <div className="space-y-6">
          <div className="flex h-14 w-14 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
            <CheckCircle2 className="h-7 w-7 text-[#166534]" strokeWidth={1.6} />
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Password updated
            </p>
            <h1 className="text-xl font-medium tracking-[-0.03em]">All set</h1>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Your password has been changed. All previous sessions have been signed out for
              security. Please sign in with your new password.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 min-h-11 w-full justify-center bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
          >
            Sign in now
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      )}
    </AuthLayout>
  );
};
