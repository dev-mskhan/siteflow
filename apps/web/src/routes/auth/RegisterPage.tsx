/**
 * RegisterPage — /register
 *
 * Form: react-hook-form + zodResolver (registerSchema from @siteflow/shared)
 * API:  useRegisterMutation (RTK Query)
 * Zero useState for field values — all managed by react-hook-form
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@siteflow/shared';
import { useRegisterMutation } from '../../features/auth/api/authApi';
import { useToast } from '../../components/ui/Toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { extractErrorMessage } from '../../lib/utils/index';

// Extend registerSchema with terms agreement
const registerFormSchema = registerSchema.and(
  z.object({
    agreeTerms: z.boolean().refine((val) => val === true, 'You must agree to the Terms of Service'),
  })
);

type RegisterFormData = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [register, { isLoading, error }] = useRegisterMutation();
  const { error: toastError, success: toastSuccess } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [registered, setRegistered] = useState(false);

  const {
    register: field,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      agreeTerms: false,
    },
  });

  const password = watch('password', '');

  // Simple password strength: 0-4 score
  const passwordStrength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', '#EF4444', '#F59E0B', '#3B82F6', '#22C55E'];

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await register({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      }).unwrap();
      toastSuccess('Account created!', 'Check your email to verify your account.');
      setRegistered(true);
    } catch (err: unknown) {
      toastError('Registration failed', extractErrorMessage(err));
    }
  };

  const apiErrorMessage = error ? extractErrorMessage(error) : null;

  if (registered) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="text-center space-y-4 py-10">
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid var(--success)' }}
          >
            ✓
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            Check your inbox
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            We sent a verification link to your email. Click it to activate your account and access your workspace.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => navigate('/login')}>
            Go to Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Join construction teams managing estimates, BOQs, and projects
        </CardDescription>
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

        <form id="register-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              autoComplete="given-name"
              placeholder="Tariq"
              aria-invalid={!!errors.firstName}
              error={errors.firstName?.message}
              {...field('firstName')}
            />
            <Input
              label="Last name"
              autoComplete="family-name"
              placeholder="Khan"
              aria-invalid={!!errors.lastName}
              error={errors.lastName?.message}
              {...field('lastName')}
            />
          </div>

          <Input
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="engineer@company.com"
            aria-invalid={!!errors.email}
            error={errors.email?.message}
            {...field('email')}
          />

          <div>
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min 8 characters"
                aria-invalid={!!errors.password}
                error={errors.password?.message}
                {...field('password')}
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
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor:
                          i <= passwordStrength
                            ? strengthColors[passwordStrength]
                            : 'var(--surface-2)',
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs" style={{ color: strengthColors[passwordStrength] }}>
                  {strengthLabels[passwordStrength]}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="agreeTerms"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded"
              style={{ accentColor: 'var(--accent-1)' }}
              {...field('agreeTerms')}
            />
            <label htmlFor="agreeTerms" className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
              I agree to the{' '}
              <Link to="/about" style={{ color: 'var(--accent-1)' }} className="hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/about" style={{ color: 'var(--accent-1)' }} className="hover:underline">
                Privacy Policy
              </Link>
            </label>
          </div>
          {errors.agreeTerms && (
            <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
              {errors.agreeTerms.message}
            </p>
          )}
        </form>
      </CardContent>

      <CardFooter className="flex-col gap-3">
        <Button
          form="register-form"
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Create account
        </Button>
        <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-1)' }} className="hover:opacity-80 transition-opacity">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
