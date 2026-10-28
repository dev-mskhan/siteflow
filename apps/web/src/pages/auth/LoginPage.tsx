import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { loginSchema, type LoginInput } from '@siteflow/shared';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { FormField, inputCls } from '../../components/ui/FormField';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { GoogleButton } from '../../components/ui/GoogleButton';
import { AuthDivider } from '../../components/ui/AuthDivider';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useLoginMutation } from '../../features/auth/authApi';
import { useAppDispatch } from '../../app/store';
import { authUserLoaded } from '../../features/auth/authSlice';
import { useAuth } from '../../features/auth/useAuth';
import {
  getFieldValidationErrors,
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAuth();
  const { error: toastError } = useToast();

  // Redirect away if already authenticated
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard';
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  const [login, { isLoading, error }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const fieldValidationErrors = getFieldValidationErrors(error);
  const inlineError =
    isInlineError(error) && Object.keys(fieldValidationErrors).length === 0
      ? getServerError(error)
      : null;

  useEffect(() => {
    if (error && isToastError(error)) {
      toastError('Sign-in failed', toastErrorMessage(error));
    }
  }, [error, toastError]);

  const onSubmit = async (data: LoginInput) => {
    try {
      const result = await login(data).unwrap();
      dispatch(authUserLoaded(result.user));
      navigate(from, { replace: true });
    } catch (requestError) {
      for (const [field, message] of Object.entries(getFieldValidationErrors(requestError as never))) {
        if (field === 'email' || field === 'password') {
          setError(field, { type: 'server', message });
        }
      }
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Welcome back
          </p>
          <h1 className="text-2xl font-medium tracking-[-0.04em] text-[var(--ink)]">
            Sign in to SiteFlow
          </h1>
        </div>

        {/* Google OAuth */}
        <GoogleButton />

        <AuthDivider />

        {/* Inline error (401 wrong credentials, 409, 422) */}
        {inlineError && (
          <InlineAlert
            variant="error"
            message={
              inlineError.code === 'UNAUTHORIZED'
                ? 'The email or password you entered is incorrect.'
                : inlineError.message
            }
          />
        )}

        {/* Email / password form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField label="Work email" error={errors.email?.message} required>
            {(id, errorId) => (
              <input
                id={id}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? errorId : undefined}
                className={inputCls(!!errors.email)}
                {...register('email')}
              />
            )}
          </FormField>

          <FormField label="Password" error={errors.password?.message} required>
            {(id, errorId) => (
              <PasswordInput
                id={id}
                autoComplete="current-password"
                placeholder="••••••••"
                hasError={!!errors.password}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? errorId : undefined}
                {...register('password')}
              />
            )}
          </FormField>

          {/* Forgot password */}
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 w-full inline-flex items-center justify-center gap-2 min-h-11 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
            {!isLoading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm text-[var(--muted)]">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
          >
            Create one free
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
