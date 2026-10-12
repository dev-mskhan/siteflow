/**
 * ResetPasswordPage — /reset-password?token=...
 *
 * Form: react-hook-form + zodResolver
 * API:  useResetPasswordMutation (RTK Query)
 * No useState for field values
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { passwordSchema } from '@siteflow/shared';
import { useResetPasswordMutation } from '../../features/auth/api/authApi';
import { useToast } from '../../components/ui/Toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { extractErrorMessage } from '../../lib/utils/index';

const schema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();
  const { success: toastSuccess } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetForm) => {
    try {
      await resetPassword({ token, newPassword: data.newPassword }).unwrap();
      toastSuccess('Password updated', 'Your password has been changed. Please sign in.');
      navigate('/login');
    } catch {
      // error shown via RTK Query error state below
    }
  };

  const apiErrorMessage = error ? extractErrorMessage(error) : null;

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-10 text-center space-y-4">
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)' }}
          >
            ✕
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Invalid link</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            The password reset link is incomplete or has expired.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => navigate('/forgot-password')}>
            Request a new link
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a strong password for your account</CardDescription>
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

        <form id="reset-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="relative">
            <Input
              label="New password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min 8 characters"
              aria-invalid={!!errors.newPassword}
              error={errors.newPassword?.message}
              {...register('newPassword')}
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

          <Input
            label="Confirm new password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter password"
            aria-invalid={!!errors.confirmPassword}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </form>
      </CardContent>

      <CardFooter className="flex-col gap-3">
        <Button
          form="reset-form"
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Update password
        </Button>
        <Link to="/login" className="text-sm hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-1)' }}>
          Cancel and return to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}
