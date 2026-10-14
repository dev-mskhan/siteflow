/**
 * useSmartCta — resolves the correct primary CTA destination + label
 * based on the current authentication and onboarding state.
 *
 * States:
 *
 *  isLoading (auth not yet initialised)
 *    → label: "Get started"   href: "/register"   (safe default, never wrong)
 *
 *  Not authenticated
 *    → label: "Start free trial"  href: "/register"
 *
 *  Authenticated, email NOT verified
 *    → label: "Verify your email"  href: "/verify-email/pending"
 *
 *  Authenticated, email verified
 *    → label: "Continue to dashboard"  href: "/dashboard"
 *    (Onboarding state — create-org vs existing org — is handled inside /dashboard
 *     once the org module is built. For now /dashboard is the stub.)
 *
 * Used by:
 *  - Navbar primary CTA button
 *  - HomePage hero "Start free trial" button
 *  - Any other marketing-site CTA that should be context-aware
 */

import { useAuth } from '../features/auth/useAuth';

export interface SmartCta {
  label: string;
  href: string;
  /** True while auth state is not yet initialised (single tick) */
  isLoading: boolean;
}

export function useSmartCta(): SmartCta {
  const { isAuthenticated, isInitialized, user } = useAuth();

  // Not initialised yet — return safe default so nothing flickers
  if (!isInitialized) {
    return { label: 'Get started', href: '/register', isLoading: true };
  }

  // Logged out
  if (!isAuthenticated) {
    return { label: 'Start free trial', href: '/register', isLoading: false };
  }

  // Authenticated but email not confirmed
  if (user && !user.emailVerified) {
    return { label: 'Verify your email', href: '/verify-email/pending', isLoading: false };
  }

  // Authenticated and verified — send to onboarding router
  // It will check org count and route to create-org, select-org, or the dashboard
  return { label: 'Continue to dashboard', href: '/onboarding', isLoading: false };
}
