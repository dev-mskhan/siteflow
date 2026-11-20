/**
 * useSmartCta — resolves the correct primary CTA destination + label
 * based on the current authentication and onboarding state.
 * Preserves ?plan= query param through the entire auth funnel.
 */

import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';

export interface SmartCta {
  label: string;
  href: string;
  isLoading: boolean;
}

export function useSmartCta(): SmartCta {
  const { isAuthenticated, isInitialized, user } = useAuth();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');
  const planSuffix = planParam ? `?plan=${planParam}` : '';

  if (!isInitialized) {
    return { label: 'Get started', href: `/register${planSuffix}`, isLoading: true };
  }

  if (!isAuthenticated) {
    return { label: 'Start free trial', href: `/register${planSuffix}`, isLoading: false };
  }

  if (user && !user.emailVerified) {
    return { label: 'Verify your email', href: `/verify-email/pending${planSuffix}`, isLoading: false };
  }

  return { label: 'Continue to dashboard', href: `/onboarding${planSuffix}`, isLoading: false };
}
