import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// ── Layouts ───────────────────────────────────────────────────────────────────
import { PublicLayout } from '../components/layout/PublicLayout';
import { AppLayout } from '../components/layout/AppLayout';

// ── Guards ────────────────────────────────────────────────────────────────────
import { RequireGuest } from '../components/guards/RequireGuest';
import { RequireAuth } from '../components/guards/RequireAuth';

// ── Auth pages ────────────────────────────────────────────────────────────────
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
import { VerifyEmailPendingPage } from '../pages/auth/VerifyEmailPendingPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { AuthCompletePage } from '../pages/auth/AuthCompletePage';
import { AcceptInvitationPage } from '../pages/auth/AcceptInvitationPage';
import { SessionsPage } from '../pages/auth/SessionsPage';

// ── Onboarding ────────────────────────────────────────────────────────────────
import { OnboardingRouter } from '../pages/onboarding/OnboardingRouter';
import { CreateOrgPage } from '../pages/onboarding/CreateOrgPage';
import { SelectOrgPage } from '../pages/onboarding/SelectOrgPage';

// ── Org app pages ─────────────────────────────────────────────────────────────
import { DashboardPage } from '../pages/app/DashboardPage';
import { MembersPage } from '../pages/app/MembersPage';
import { OrgSettingsLayout } from '../pages/app/settings/OrgSettingsLayout';
import { GeneralSettingsPage } from '../pages/app/settings/GeneralSettingsPage';
import { ProfileSettingsPage } from '../pages/app/settings/ProfileSettingsPage';
import { SequenceSettingsPage } from '../pages/app/settings/SequenceSettingsPage';
import { AuditLogPage } from '../pages/app/settings/AuditLogPage';

// ── Project pages ─────────────────────────────────────────────────────────────
import { ProjectListPage } from '../pages/app/ProjectListPage';
import { ProjectShell } from '../pages/app/project/ProjectShell';
import { ProjectOverviewPage } from '../pages/app/project/ProjectOverviewPage';
import { ProjectPhasesPage } from '../pages/app/project/ProjectPhasesPage';
import { ProjectCostCodesPage } from '../pages/app/project/ProjectCostCodesPage';
import { ProjectBudgetPage } from '../pages/app/project/ProjectBudgetPage';
import { ProjectTeamPage } from '../pages/app/project/ProjectTeamPage';
import { ProjectSettingsPage } from '../pages/app/project/ProjectSettingsPage';
import { ProjectFieldLogsPage } from '../pages/ProjectFieldLogsPage';
import { ProjectFieldLogDetailPage } from '../pages/ProjectFieldLogDetailPage';
import { ProjectIssuesPage } from '../pages/ProjectIssuesPage';
import { ProjectIssueDetailPage } from '../pages/ProjectIssueDetailPage';
import { ProjectTasksPage } from '../pages/ProjectTasksPage';
import { ProjectTaskDetailPage } from '../pages/ProjectTaskDetailPage';
import { ProjectBaselinesPage } from '../pages/ProjectBaselinesPage';
import { ProjectCalendarPage } from '../pages/ProjectCalendarPage';
import { ProcurementShell } from '../pages/procurement/ProcurementShell';
import { MaterialRequestsPage } from '../pages/procurement/MaterialRequestsPage';
import { QuotesPage } from '../pages/procurement/QuotesPage';
import { PurchaseOrdersPage } from '../pages/procurement/PurchaseOrdersPage';
import { ApprovalsPage } from '../pages/procurement/ApprovalsPage';
import { DeliveriesPage } from '../pages/procurement/DeliveriesPage';
import { CommittedCostsPage } from '../pages/procurement/CommittedCostsPage';
import { InventoryLedgerPage } from '../pages/procurement/InventoryLedgerPage';
import { SuppliersPage } from '../pages/app/SuppliersPage';
import { SupplierDetailPage } from '../pages/app/SupplierDetailPage';
import { MaterialsPage } from '../pages/app/MaterialsPage';

// ── Marketing pages ───────────────────────────────────────────────────────────
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
  // ── Auth (no shell) ────────────────────────────────────────────────────────
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

  // ── Onboarding (no org shell) ──────────────────────────────────────────────
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

  // ── App shell (/org/:orgId/*) — OrgBootstrap lives inside AppLayout ────────
  {
    path: '/org/:orgId',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },

      // Org-level pages
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'members', element: <MembersPage /> },

      // Project list
      { path: 'projects', element: <ProjectListPage /> },

      // Org catalog
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'suppliers/:supplierId', element: <SupplierDetailPage /> },
      { path: 'materials', element: <MaterialsPage /> },

      // Project detail — ProjectShell owns the sub-nav + loads active project
      {
        path: 'projects/:projectId',
        element: <ProjectShell />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          { path: 'phases', element: <ProjectPhasesPage /> },
          { path: 'cost-codes', element: <ProjectCostCodesPage /> },
          { path: 'budget', element: <ProjectBudgetPage /> },
          { path: 'team', element: <ProjectTeamPage /> },
          { path: 'field-logs', element: <ProjectFieldLogsPage /> },
          { path: 'field-logs/:logId', element: <ProjectFieldLogDetailPage /> },
          { path: 'issues', element: <ProjectIssuesPage /> },
          { path: 'issues/:issueId', element: <ProjectIssueDetailPage /> },
          { path: 'tasks', element: <ProjectTasksPage /> },
          { path: 'tasks/:taskId', element: <ProjectTaskDetailPage /> },
          { path: 'baselines', element: <ProjectBaselinesPage /> },
          { path: 'calendar', element: <ProjectCalendarPage /> },
          {
            path: 'procurement',
            element: <ProcurementShell />,
            children: [
              { path: 'requests', element: <MaterialRequestsPage /> },
              { path: 'quotes', element: <QuotesPage /> },
              { path: 'orders', element: <PurchaseOrdersPage /> },
              { path: 'approvals', element: <ApprovalsPage /> },
              { path: 'deliveries', element: <DeliveriesPage /> },
              { path: 'committed', element: <CommittedCostsPage /> },
            ],
          },
          { path: 'inventory', element: <InventoryLedgerPage /> },
          { path: 'settings', element: <ProjectSettingsPage /> },
        ],
      },

      // Org settings
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

  // ── Marketing site (PublicLayout: Navbar + Footer) ─────────────────────────
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
