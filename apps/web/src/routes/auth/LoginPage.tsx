/**
 * LoginPage — /login
 *
 * Form: react-hook-form + zodResolver (canonical loginSchema from @siteflow/shared)
 * API:  useLoginMutation (RTK Query)
 * No useState for field values — all managed by react-hook-form
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginSchema } from '@siteflow/shared';
import type { LoginInput } from '@siteflow/shared';
import { useLoginMutation } from '../../features/auth/api/authApi';
import { useToast } from '../../components/ui/Toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { extractErrorMessage } from '../../lib/utils/index';
import { useState } from 'react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading, error }] = useLoginMutation();
  const { error: toastError, success: toastSuccess } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/projects';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      await login(data).unwrap();
      toastSuccess('Welcome back!', 'Successfully signed in.');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      toastError('Sign in failed', extractErrorMessage(err));
    }
  };

  const apiErrorMessage = error ? extractErrorMessage(error) : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to SiteFlow</CardTitle>
        <CardDescription>Enter your credentials to access your workspace</CardDescription>
      </CardHeader>

      <CardContent>
        {apiErrorMessage && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 rounded-xl text-sm border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
            }}
          >
            {apiErrorMessage}
          </div>
        )}

        <form id="login-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              error={errors.password?.message}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-[38px] text-xs"
              style={{ color: 'var(--text-muted)' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span />
            <Link
              to="/forgot-password"
              className="hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-1)' }}
            >
              Forgot password?
            </Link>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex-col gap-3">
        <Button
          form="login-form"
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Sign in
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            const base =
              (typeof import.meta !== 'undefined' &&
                (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env
                  ?.VITE_API_URL) ||
              '/api/v1';
            window.location.href = `${base}/auth/google`;
          }}
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-1)' }} className="hover:opacity-80 transition-opacity">
            Create one
          </Link>{' '}
          or{' '}
          <Link to="/trial" style={{ color: 'var(--accent-1)' }} className="hover:opacity-80 transition-opacity">
            start a free trial
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
