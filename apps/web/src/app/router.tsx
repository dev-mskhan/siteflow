import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// ── Layouts ──────────────────────────────────────────────────────────────────
import { PublicLayout } from '../components/layout/PublicLayout';

// ── Guards ───────────────────────────────────────────────────────────────────
import { RequireGuest } from '../components/guards/RequireGuest';
import { RequireAuth } from '../components/guards/RequireAuth';

// ── Auth pages ───────────────────────────────────────────────────────────────
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
import { VerifyEmailPendingPage } from '../pages/auth/VerifyEmailPendingPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { AuthCompletePage } from '../pages/auth/AuthCompletePage';
import { AcceptInvitationPage } from '../pages/auth/AcceptInvitationPage';
import { SessionsPage } from '../pages/auth/SessionsPage';

// ── Marketing pages ──────────────────────────────────────────────────────────
import { HomePage } from '../pages/HomePage';
import { FeaturesOverviewPage } from '../pages/FeaturesOverviewPage';
import { FeaturePage } from '../pages/FeaturePage';
import { PersonaPage } from '../pages/PersonaPage';
import { CountryPage } from '../pages/CountryPage';
import { PricingPage } from '../pages/PricingPage';
import { ContactPage } from '../pages/ContactPage';
import { AboutPage } from '../pages/AboutPage';
import { SecurityPage } from '../pages/SecurityPage';
import { PrivacyPage } from '../pages/legal/PrivacyPage';
import { TermsPage } from '../pages/legal/TermsPage';
import { CookiesPage } from '../pages/legal/CookiesPage';
import { ThanksPage } from '../pages/ThanksPage';
import { NotFoundPage } from '../pages/NotFoundPage';

// ── Dashboard stub ───────────────────────────────────────────────────────────
// Temporary placeholder. Replaced when the app shell is built.
const DashboardStub: React.FC = () => (
  <div className="flex min-h-dvh items-center justify-center bg-[var(--surface)] text-[var(--ink)]">
    <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-10 text-center max-w-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        Coming soon
      </p>
      <h1 className="mt-3 text-2xl font-medium tracking-[-0.04em]">Dashboard</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Auth is working. The app shell is the next module.
      </p>
    </div>
  </div>
);

export const router = createBrowserRouter([
  // ── Auth routes (no nav/footer shell) ──────────────────────────────────────
  {
    path: '/login',
    element: (
      <RequireGuest>
        <LoginPage />
      </RequireGuest>
    ),
  },
  {
    path: '/register',
    element: (
      <RequireGuest>
        <RegisterPage />
      </RequireGuest>
    ),
  },
  {
    path: '/verify-email',
    element: <VerifyEmailPage />,
  },
  {
    path: '/verify-email/pending',
    element: (
      <RequireAuth allowUnverified>
        <VerifyEmailPendingPage />
      </RequireAuth>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <RequireGuest>
        <ForgotPasswordPage />
      </RequireGuest>
    ),
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    // Landing page for Google OAuth redirect from server
    path: '/auth/complete',
    element: <AuthCompletePage />,
  },
  {
    // Invitation links from email
    path: '/invitations/:token',
    element: <AcceptInvitationPage />,
  },

  // ── Protected app routes (no nav/footer shell yet) ────────────────────────
  {
    path: '/dashboard',
    element: (
      <RequireAuth>
        <DashboardStub />
      </RequireAuth>
    ),
  },
  {
    // Temporary /onboarding redirect — will be a real page in the org module
    path: '/onboarding',
    element: (
      <RequireAuth>
        <Navigate to="/dashboard" replace />
      </RequireAuth>
    ),
  },
  {
    path: '/settings/sessions',
    element: (
      <RequireAuth>
        <SessionsPage />
      </RequireAuth>
    ),
  },

  // ── Marketing site (PublicLayout with Navbar + Footer) ───────────────────
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'features', element: <FeaturesOverviewPage /> },
      { path: 'features/:slug', element: <FeaturePage /> },
      { path: 'for/:personaSlug', element: <PersonaPage /> },
      { path: 'construction-software-pakistan', element: <CountryPage /> },
      { path: 'construction-software-us', element: <CountryPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'security', element: <SecurityPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'cookies', element: <CookiesPage /> },
      { path: 'thanks', element: <ThanksPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
