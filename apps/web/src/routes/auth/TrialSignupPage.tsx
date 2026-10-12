/**
 * TrialSignupPage — /trial
 *
 * Form: react-hook-form + zodResolver
 * API:  useRegisterMutation (RTK Query)
 * Zustand: sets locale preference after signup
 * No useState for field values
 */

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { nameSchema, emailSchema, passwordSchema } from '@siteflow/shared';
import { useRegisterMutation } from '../../features/auth/api/authApi';
import { useAppStore } from '../../lib/store/appStore';
import { useToast } from '../../components/ui/Toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { extractErrorMessage } from '../../lib/utils/index';

const trialSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema.optional(),
  email: emailSchema,
  password: passwordSchema,
  locale: z.enum(['USD', 'PKR']),
});

type TrialFormData = z.infer<typeof trialSchema>;

export default function TrialSignupPage() {
  const navigate = useNavigate();
  const [register, { isLoading, error }] = useRegisterMutation();
  const setLocale = useAppStore((s) => s.setLocale);
  const { success: toastSuccess } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register: field,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TrialFormData>({
    resolver: zodResolver(trialSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      locale: 'USD',
    },
  });

  const onSubmit = async (data: TrialFormData) => {
    try {
      await register({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      }).unwrap();
      // Save locale preference to Zustand (persisted to localStorage)
      setLocale(data.locale);
      toastSuccess('Trial started!', 'Check your email to verify your account.');
      navigate('/login');
    } catch {
      // error displayed via RTK Query error state
    }
  };

  const apiErrorMessage = error ? extractErrorMessage(error) : null;

  return (
    <div className="w-full max-w-lg">
      {/* Trial badge */}
      <div className="text-center mb-6">
        <span
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: 'linear-gradient(135deg, rgba(255,106,43,0.15), rgba(255,181,71,0.15))',
            border: '1px solid rgba(255,106,43,0.3)',
            color: 'var(--accent-1)',
          }}
        >
          🏗️ 14-day free trial · No credit card required
        </span>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Start your free trial</CardTitle>
          <CardDescription>
            Get full access to SiteFlow for 14 days — estimates, BOQs, scheduling, procurement, and payments.
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

          <form id="trial-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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

            {/* Locale toggle */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Default currency
              </label>
              <Controller
                name="locale"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <div className="flex gap-2">
                    {(['USD', 'PKR'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all"
                        style={{
                          background: value === opt ? 'linear-gradient(135deg, #FF6A2B, #FFB547)' : 'var(--surface-2)',
                          borderColor: value === opt ? 'transparent' : 'var(--border)',
                          color: value === opt ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {opt === 'USD' ? '$ USD (US)' : '₨ PKR (Pakistan)'}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button
            form="trial-form"
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isLoading}
            disabled={isLoading}
          >
            Start 14-day free trial
          </Button>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-1)' }} className="hover:opacity-80 transition-opacity">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
