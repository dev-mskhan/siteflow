/**
 * ForgotPasswordPage — /forgot-password
 *
 * Form: react-hook-form + zodResolver (forgotPasswordSchema)
 * API:  useForgotPasswordMutation (RTK Query)
 * Success state replaces the form entirely (intentionally ambiguous message)
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema } from '@siteflow/shared';
import type { ForgotPasswordInput } from '@siteflow/shared';
import { useForgotPasswordMutation } from '../../features/auth/api/authApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      await forgotPassword({ email: data.email }).unwrap();
    } finally {
      // Always show success — server response is intentionally ambiguous
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="text-center space-y-4 py-10">
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', border: '1px solid var(--success)' }}
          >
            ✉
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            Check your inbox
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            If an account is registered to <strong style={{ color: 'var(--text)' }}>{getValues('email')}</strong>,
            we've sent a password reset link. Check your spam folder if it doesn't arrive within a few minutes.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => setSent(false)}>
            Try a different email
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/login" className="text-sm hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-1)' }}>
            ← Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter the email address registered with your account and we'll send a reset link.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form id="forgot-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Input
            label="Account email"
            type="email"
            autoComplete="email"
            placeholder="engineer@company.com"
            aria-invalid={!!errors.email}
            error={errors.email?.message}
            {...register('email')}
          />
        </form>
      </CardContent>

      <CardFooter className="flex-col gap-3">
        <Button
          form="forgot-form"
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Send reset link
        </Button>
        <Link to="/login" className="text-sm hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-1)' }}>
          ← Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}
