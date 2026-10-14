import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// ── Layouts ──────────────────────────────────────────────────────────────────
import { PublicLayout } from '../components/layout/PublicLayout';
import { AppLayout } from '../components/layout/AppLayout';

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

// ── Onboarding ───────────────────────────────────────────────────────────────
import { OnboardingRouter } from '../pages/onboarding/OnboardingRouter';
import { CreateOrgPage } from '../pages/onboarding/CreateOrgPage';
import { SelectOrgPage } from '../pages/onboarding/SelectOrgPage';

// ── App pages ─────────────────────────────────────────────────────────────────
import { DashboardPage } from '../pages/app/DashboardPage';
import { MembersPage } from '../pages/app/MembersPage';
import { OrgSettingsLayout } from '../pages/app/settings/OrgSettingsLayout';
import { GeneralSettingsPage } from '../pages/app/settings/GeneralSettingsPage';
import { ProfileSettingsPage } from '../pages/app/settings/ProfileSettingsPage';
import { SequenceSettingsPage } from '../pages/app/settings/SequenceSettingsPage';
import { AuditLogPage } from '../pages/app/settings/AuditLogPage';

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

export const router = createBrowserRouter([
  // ── Auth routes ────────────────────────────────────────────────────────────
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
  { path: '/verify-email', element: <VerifyEmailPage /> },
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
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/auth/complete', element: <AuthCompletePage /> },
  { path: '/invitations/:token', element: <AcceptInvitationPage /> },
  {
    path: '/settings/sessions',
    element: (
      <RequireAuth>
        <SessionsPage />
      </RequireAuth>
    ),
  },

  // ── Onboarding ────────────────────────────────────────────────────────────
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <OnboardingRouter />
      </RequireAuth>
    ),
  },
  {
    path: '/onboarding/create-org',
    element: (
      <RequireAuth>
        <CreateOrgPage />
      </RequireAuth>
    ),
  },
  {
    path: '/onboarding/select-org',
    element: (
      <RequireAuth>
        <SelectOrgPage />
      </RequireAuth>
    ),
  },

  // ── App — all routes under /org/:orgId use AppLayout (OrgBootstrap inside) ─
  {
    path: '/org/:orgId',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'members', element: <MembersPage /> },
      {
        path: 'settings',
        element: <OrgSettingsLayout />,
        children: [
          { index: true, element: <GeneralSettingsPage /> },
          { path: 'profile', element: <ProfileSettingsPage /> },
          { path: 'sequences', element: <SequenceSettingsPage /> },
          { path: 'audit', element: <AuditLogPage /> },
        ],
      },
    ],
  },

  // ── Marketing site (PublicLayout: Navbar + Footer) ────────────────────────
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
