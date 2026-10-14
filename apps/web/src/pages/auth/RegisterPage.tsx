import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@siteflow/shared';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { FormField, inputCls } from '../../components/ui/FormField';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { GoogleButton } from '../../components/ui/GoogleButton';
import { AuthDivider } from '../../components/ui/AuthDivider';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useRegisterMutation } from '../../features/auth/authApi';
import { useAppDispatch } from '../../app/store';
import { authUserLoaded } from '../../features/auth/authSlice';
import { useAuth } from '../../features/auth/useAuth';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAuth();
  const { error: toastError } = useToast();

  // If already authenticated, go to post-login routing
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const [registerUser, { isLoading, error }] = useRegisterMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  // Show toast for non-form errors (429, 500, network)
  useEffect(() => {
    if (error && isToastError(error)) {
      toastError('Registration failed', toastErrorMessage(error));
    }
  }, [error, toastError]);

  const inlineError = isInlineError(error) ? getServerError(error) : null;

  const onSubmit = async (data: RegisterInput) => {
    try {
      const result = await registerUser(data).unwrap();
      dispatch(authUserLoaded(result.user));
      // Registration always requires email verification before org creation
      navigate('/verify-email/pending', { replace: true });
    } catch {
      // Handled via `error` state above
    }
  };

  return (
    <AuthLayout
      headline={
        <>
          Build tighter projects.
          <br />
          <em className="font-serif font-light not-italic italic">Start</em> for free.
        </>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Create your account
          </p>
          <h1 className="text-2xl font-medium tracking-[-0.04em] text-[var(--ink)]">
            Get started with SiteFlow
          </h1>
          <p className="text-sm text-[var(--muted)]">14-day free trial · No credit card required</p>
        </div>

        {/* Google OAuth */}
        <GoogleButton label="Sign up with Google" />

        <AuthDivider />

        {/* Inline error */}
        {inlineError && (
          <InlineAlert
            variant="error"
            message={
              inlineError.code === 'CONFLICT'
                ? 'An account with this email already exists. Try signing in instead.'
                : inlineError.message
            }
          />
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name" error={errors.firstName?.message} required>
              {(id) => (
                <input
                  id={id}
                  type="text"
                  autoComplete="given-name"
                  placeholder="Tariq"
                  className={inputCls(!!errors.firstName)}
                  {...register('firstName')}
                />
              )}
            </FormField>

            <FormField label="Last name" error={errors.lastName?.message}>
              {(id) => (
                <input
                  id={id}
                  type="text"
                  autoComplete="family-name"
                  placeholder="Mehmood"
                  className={inputCls(!!errors.lastName)}
                  {...register('lastName')}
                />
              )}
            </FormField>
          </div>

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

          <FormField
            label="Password"
            error={errors.password?.message}
            hint="At least 8 characters"
            required
          >
            {(id) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                placeholder="Create a strong password"
                hasError={!!errors.password}
                {...register('password')}
              />
            )}
          </FormField>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 w-full inline-flex items-center justify-center gap-2 min-h-11 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {isLoading ? 'Creating account…' : 'Create free account'}
            {!isLoading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
          </button>
        </form>

        {/* Login link */}
        <p className="text-center text-sm text-[var(--muted)]">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
          >
            Sign in
          </Link>
        </p>

        {/* Legal */}
        <p className="text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] leading-relaxed">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-[var(--ink)] transition-colors">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-[var(--ink)] transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
