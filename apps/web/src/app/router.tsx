import React, { lazy } from 'react';
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
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const VerifyEmailPendingPage = lazy(() => import('../pages/auth/VerifyEmailPendingPage').then((m) => ({ default: m.VerifyEmailPendingPage })));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const AuthCompletePage = lazy(() => import('../pages/auth/AuthCompletePage').then((m) => ({ default: m.AuthCompletePage })));
const AcceptInvitationPage = lazy(() => import('../pages/auth/AcceptInvitationPage').then((m) => ({ default: m.AcceptInvitationPage })));
const SessionsPage = lazy(() => import('../pages/auth/SessionsPage').then((m) => ({ default: m.SessionsPage })));

// ── Onboarding ────────────────────────────────────────────────────────────────
import { OnboardingRouter } from '../pages/onboarding/OnboardingRouter';
const CreateOrgPage = lazy(() => import('../pages/onboarding/CreateOrgPage').then((m) => ({ default: m.CreateOrgPage })));
const SelectOrgPage = lazy(() => import('../pages/onboarding/SelectOrgPage').then((m) => ({ default: m.SelectOrgPage })));

// ── Org app pages ─────────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('../pages/app/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const MembersPage = lazy(() => import('../pages/app/MembersPage').then((m) => ({ default: m.MembersPage })));
import { OrgSettingsLayout } from '../pages/app/settings/OrgSettingsLayout';
const GeneralSettingsPage = lazy(() => import('../pages/app/settings/GeneralSettingsPage').then((m) => ({ default: m.GeneralSettingsPage })));
const ProfileSettingsPage = lazy(() => import('../pages/app/settings/ProfileSettingsPage').then((m) => ({ default: m.ProfileSettingsPage })));
const SequenceSettingsPage = lazy(() => import('../pages/app/settings/SequenceSettingsPage').then((m) => ({ default: m.SequenceSettingsPage })));
const AuditLogPage = lazy(() => import('../pages/app/settings/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const BillingPage = lazy(() => import('../pages/app/settings/BillingPage').then((m) => ({ default: m.BillingPage })));
const ExportsPage = lazy(() => import('../pages/app/settings/ExportsPage').then((m) => ({ default: m.ExportsPage })));
const NotificationPreferencesPage = lazy(() => import('../pages/app/settings/NotificationPreferencesPage').then((m) => ({ default: m.NotificationPreferencesPage })));

// ── Project pages ─────────────────────────────────────────────────────────────
const ProjectListPage = lazy(() => import('../pages/app/ProjectListPage').then((m) => ({ default: m.ProjectListPage })));
import { ProjectShell } from '../pages/app/project/ProjectShell';
const ProjectOverviewPage = lazy(() => import('../pages/app/project/ProjectOverviewPage').then((m) => ({ default: m.ProjectOverviewPage })));
const ProjectPhasesPage = lazy(() => import('../pages/app/project/ProjectPhasesPage').then((m) => ({ default: m.ProjectPhasesPage })));
const ProjectCostCodesPage = lazy(() => import('../pages/app/project/ProjectCostCodesPage').then((m) => ({ default: m.ProjectCostCodesPage })));
const ProjectBudgetPage = lazy(() => import('../pages/app/project/ProjectBudgetPage').then((m) => ({ default: m.ProjectBudgetPage })));
const ProjectTeamPage = lazy(() => import('../pages/app/project/ProjectTeamPage').then((m) => ({ default: m.ProjectTeamPage })));
const ProjectSettingsPage = lazy(() => import('../pages/app/project/ProjectSettingsPage').then((m) => ({ default: m.ProjectSettingsPage })));
const ProjectAuditPage = lazy(() => import('../pages/app/project/ProjectAuditPage').then((m) => ({ default: m.ProjectAuditPage })));
const ProjectScheduleHistoryPage = lazy(() => import('../pages/app/project/ProjectScheduleHistoryPage').then((m) => ({ default: m.ProjectScheduleHistoryPage })));
const ProjectFieldLogsPage = lazy(() => import('../pages/ProjectFieldLogsPage').then((m) => ({ default: m.ProjectFieldLogsPage })));
const ProjectFieldLogDetailPage = lazy(() => import('../pages/ProjectFieldLogDetailPage').then((m) => ({ default: m.ProjectFieldLogDetailPage })));
const ProjectIssuesPage = lazy(() => import('../pages/ProjectIssuesPage').then((m) => ({ default: m.ProjectIssuesPage })));
const ProjectIssueDetailPage = lazy(() => import('../pages/ProjectIssueDetailPage').then((m) => ({ default: m.ProjectIssueDetailPage })));
const ProjectTasksPage = lazy(() => import('../pages/ProjectTasksPage').then((m) => ({ default: m.ProjectTasksPage })));
const ProjectTaskDetailPage = lazy(() => import('../pages/ProjectTaskDetailPage').then((m) => ({ default: m.ProjectTaskDetailPage })));
const ProjectBaselinesPage = lazy(() => import('../pages/ProjectBaselinesPage').then((m) => ({ default: m.ProjectBaselinesPage })));
const ProjectCalendarPage = lazy(() => import('../pages/ProjectCalendarPage').then((m) => ({ default: m.ProjectCalendarPage })));
const ProjectSubcontractorsPage = lazy(() => import('../pages/ProjectSubcontractorsPage').then((m) => ({ default: m.ProjectSubcontractorsPage })));
import { ProcurementShell } from '../pages/procurement/ProcurementShell';
const PreconstructionShell = lazy(() => import('../pages/preconstruction/PreconstructionShell').then((m) => ({ default: m.PreconstructionShell })));
const CommercialShell = lazy(() => import('../pages/commercial/CommercialShell').then((m) => ({ default: m.CommercialShell })));
const ChangeOrdersPage = lazy(() => import('../pages/commercial/ChangeOrdersPage').then((m) => ({ default: m.ChangeOrdersPage })));
const SOVPage = lazy(() => import('../pages/commercial/SOVPage').then((m) => ({ default: m.SOVPage })));
const PaymentApplicationsPage = lazy(() => import('../pages/commercial/PaymentApplicationsPage').then((m) => ({ default: m.PaymentApplicationsPage })));
const InvoicesPage = lazy(() => import('../pages/commercial/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const PaymentsPage = lazy(() => import('../pages/commercial/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const RetainagePage = lazy(() => import('../pages/commercial/RetainagePage').then((m) => ({ default: m.RetainagePage })));
const CostTransactionsPage = lazy(() => import('../pages/commercial/CostTransactionsPage').then((m) => ({ default: m.CostTransactionsPage })));
const CommercialSummaryPage = lazy(() => import('../pages/commercial/CommercialSummaryPage').then((m) => ({ default: m.CommercialSummaryPage })));
const FinancialSummaryPage = lazy(() => import('../pages/commercial/FinancialSummaryPage').then((m) => ({ default: m.FinancialSummaryPage })));
const ProposalsPage = lazy(() => import('../pages/preconstruction/ProposalsPage').then((m) => ({ default: m.ProposalsPage })));
const EstimatesPage = lazy(() => import('../pages/preconstruction/EstimatesPage').then((m) => ({ default: m.EstimatesPage })));
const BOQPage = lazy(() => import('../pages/preconstruction/BOQPage').then((m) => ({ default: m.BOQPage })));
const TakeoffsPage = lazy(() => import('../pages/preconstruction/TakeoffsPage').then((m) => ({ default: m.TakeoffsPage })));
const PricingPage = lazy(() => import('../pages/preconstruction/PricingPage').then((m) => ({ default: m.PricingPage })));
const TendersPage = lazy(() => import('../pages/app/TendersPage').then((m) => ({ default: m.TendersPage })));
const TenderDetailPage = lazy(() => import('../pages/app/TenderDetailPage').then((m) => ({ default: m.TenderDetailPage })));
const ProposalDetailPage = lazy(() => import('../pages/preconstruction/ProposalDetailPage').then((m) => ({ default: m.ProposalDetailPage })));
const EstimateDetailPage = lazy(() => import('../pages/preconstruction/EstimateDetailPage').then((m) => ({ default: m.EstimateDetailPage })));
const MaterialRequestsPage = lazy(() => import('../pages/procurement/MaterialRequestsPage').then((m) => ({ default: m.MaterialRequestsPage })));
const QuotesPage = lazy(() => import('../pages/procurement/QuotesPage').then((m) => ({ default: m.QuotesPage })));
const PurchaseOrdersPage = lazy(() => import('../pages/procurement/PurchaseOrdersPage').then((m) => ({ default: m.PurchaseOrdersPage })));
const ApprovalsPage = lazy(() => import('../pages/procurement/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })));
const DeliveriesPage = lazy(() => import('../pages/procurement/DeliveriesPage').then((m) => ({ default: m.DeliveriesPage })));
const CommittedCostsPage = lazy(() => import('../pages/procurement/CommittedCostsPage').then((m) => ({ default: m.CommittedCostsPage })));
const InventoryLedgerPage = lazy(() => import('../pages/procurement/InventoryLedgerPage').then((m) => ({ default: m.InventoryLedgerPage })));
const SuppliersPage = lazy(() => import('../pages/app/SuppliersPage').then((m) => ({ default: m.SuppliersPage })));
const SupplierDetailPage = lazy(() => import('../pages/app/SupplierDetailPage').then((m) => ({ default: m.SupplierDetailPage })));
const SubcontractorsPage = lazy(() => import('../pages/app/SubcontractorsPage').then((m) => ({ default: m.SubcontractorsPage })));
const SubcontractorDetailPage = lazy(() => import('../pages/app/SubcontractorDetailPage').then((m) => ({ default: m.SubcontractorDetailPage })));
const MaterialsPage = lazy(() => import('../pages/app/MaterialsPage').then((m) => ({ default: m.MaterialsPage })));

// ── Groups 9-13 pages ─────────────────────────────────────────────────────────
const ProjectDocumentsPage = lazy(() => import('../pages/ProjectDocumentsPage').then((m) => ({ default: m.ProjectDocumentsPage })));
const ProjectSafetyPage = lazy(() => import('../pages/hse/ProjectSafetyPage').then((m) => ({ default: m.ProjectSafetyPage })));
const ProjectQualityPage = lazy(() => import('../pages/hse/ProjectQualityPage').then((m) => ({ default: m.ProjectQualityPage })));
const ProjectCompliancePage = lazy(() => import('../pages/hse/ProjectCompliancePage').then((m) => ({ default: m.ProjectCompliancePage })));
const ProjectRFIsPage = lazy(() => import('../pages/ProjectRFIsPage').then((m) => ({ default: m.ProjectRFIsPage })));
const ProjectSubmittalsPage = lazy(() => import('../pages/ProjectSubmittalsPage').then((m) => ({ default: m.ProjectSubmittalsPage })));
const ProjectReportsShell = lazy(() => import('../pages/reports/ProjectReportsShell').then((m) => ({ default: m.ProjectReportsShell })));
const ProjectHealthReportPage = lazy(() => import('../pages/reports/ProjectHealthReportPage').then((m) => ({ default: m.ProjectHealthReportPage })));
const ProjectScheduleReportPage = lazy(() => import('../pages/reports/ProjectScheduleReportPage').then((m) => ({ default: m.ProjectScheduleReportPage })));
const ProjectCostReportPage = lazy(() => import('../pages/reports/ProjectCostReportPage').then((m) => ({ default: m.ProjectCostReportPage })));
const ProjectProcurementReportPage = lazy(() => import('../pages/reports/ProjectProcurementReportPage').then((m) => ({ default: m.ProjectProcurementReportPage })));
const ProjectSubcontractorReportPage = lazy(() => import('../pages/reports/ProjectSubcontractorReportPage').then((m) => ({ default: m.ProjectSubcontractorReportPage })));
const ProjectExecutiveReportPage = lazy(() => import('../pages/reports/ProjectExecutiveReportPage').then((m) => ({ default: m.ProjectExecutiveReportPage })));
const PortfolioReportPage = lazy(() => import('../pages/PortfolioReportPage').then((m) => ({ default: m.PortfolioReportPage })));

// ── Platform admin console ──────────────────────────────────────────────────
import { PlatformLayout } from '../components/layout/PlatformLayout';
const PlatformOrganizationsPage = lazy(() => import('../pages/platform/PlatformOrganizationsPage').then((m) => ({ default: m.PlatformOrganizationsPage })));
const PlatformAccountsPage = lazy(() => import('../pages/platform/PlatformAccountsPage').then((m) => ({ default: m.PlatformAccountsPage })));
const PlatformDiagnosticsPage = lazy(() => import('../pages/platform/PlatformDiagnosticsPage').then((m) => ({ default: m.PlatformDiagnosticsPage })));
const PlatformBillingPage = lazy(() => import('../pages/platform/PlatformBillingPage').then((m) => ({ default: m.PlatformBillingPage })));
const PlatformSupportGrantsPage = lazy(() => import('../pages/platform/PlatformSupportGrantsPage').then((m) => ({ default: m.PlatformSupportGrantsPage })));

// ── Marketing pages ───────────────────────────────────────────────────────────
const HomePage = lazy(() => import('../pages/HomePage').then((m) => ({ default: m.HomePage })));
const FeaturesOverviewPage = lazy(() => import('../pages/FeaturesOverviewPage').then((m) => ({ default: m.FeaturesOverviewPage })));
const FeaturePage = lazy(() => import('../pages/FeaturePage').then((m) => ({ default: m.FeaturePage })));
const PersonaPage = lazy(() => import('../pages/PersonaPage').then((m) => ({ default: m.PersonaPage })));
const CountryPage = lazy(() => import('../pages/CountryPage').then((m) => ({ default: m.CountryPage })));
const MarketingPricingPage = lazy(() => import('../pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const ContactPage = lazy(() => import('../pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const AboutPage = lazy(() => import('../pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const SecurityPage = lazy(() => import('../pages/SecurityPage').then((m) => ({ default: m.SecurityPage })));
const PrivacyPage = lazy(() => import('../pages/legal/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage').then((m) => ({ default: m.TermsPage })));
const CookiesPage = lazy(() => import('../pages/legal/CookiesPage').then((m) => ({ default: m.CookiesPage })));
const ThanksPage = lazy(() => import('../pages/ThanksPage').then((m) => ({ default: m.ThanksPage })));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

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
      { path: 'subcontractors', element: <SubcontractorsPage /> },
      { path: 'subcontractors/:subcontractorId', element: <SubcontractorDetailPage /> },
      { path: 'materials', element: <MaterialsPage /> },
      { path: 'tenders', element: <TendersPage /> },
      { path: 'tenders/:tenderId', element: <TenderDetailPage /> },
      { path: 'reports/portfolio', element: <PortfolioReportPage /> },

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
          { path: 'subcontractors', element: <ProjectSubcontractorsPage /> },
          {
            path: 'commercial',
            element: <CommercialShell />,
            children: [
              { path: 'change-orders', element: <ChangeOrdersPage /> },
              { path: 'sov', element: <SOVPage /> },
              { path: 'payment-applications', element: <PaymentApplicationsPage /> },
              { path: 'invoices', element: <InvoicesPage /> },
              { path: 'payments', element: <PaymentsPage /> },
              { path: 'retainage', element: <RetainagePage /> },
              { path: 'cost-transactions', element: <CostTransactionsPage /> },
              { path: 'commercial-summary', element: <CommercialSummaryPage /> },
              { path: 'financial-summary', element: <FinancialSummaryPage /> },
            ],
          },
          {
            path: 'preconstruction',
            element: <PreconstructionShell />,
            children: [
              { path: 'proposals', element: <ProposalsPage /> },
              { path: 'proposals/:proposalId', element: <ProposalDetailPage /> },
              { path: 'estimates', element: <EstimatesPage /> },
              { path: 'estimates/:estimateId', element: <EstimateDetailPage /> },
              { path: 'boq', element: <BOQPage /> },
              { path: 'takeoffs', element: <TakeoffsPage /> },
              { path: 'pricing', element: <PricingPage /> },
            ],
          },
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
          { path: 'audit', element: <ProjectAuditPage /> },
          { path: 'schedule-history', element: <ProjectScheduleHistoryPage /> },
          // Group 9 — Documents
          { path: 'documents', element: <ProjectDocumentsPage /> },
          // Group 10 — HSE
          { path: 'safety', element: <ProjectSafetyPage /> },
          { path: 'quality', element: <ProjectQualityPage /> },
          { path: 'compliance', element: <ProjectCompliancePage /> },
          // Group 11 — RFI / Submittals
          { path: 'rfis', element: <ProjectRFIsPage /> },
          { path: 'submittals', element: <ProjectSubmittalsPage /> },
          // Group 12 — Reports
          {
            path: 'reports',
            element: <ProjectReportsShell />,
            children: [
              { index: true, element: <Navigate to="health" replace /> },
              { path: 'health', element: <ProjectHealthReportPage /> },
              { path: 'schedule', element: <ProjectScheduleReportPage /> },
              { path: 'cost', element: <ProjectCostReportPage /> },
              { path: 'procurement', element: <ProjectProcurementReportPage /> },
              { path: 'subcontractor', element: <ProjectSubcontractorReportPage /> },
              { path: 'executive', element: <ProjectExecutiveReportPage /> },
            ],
          },
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
          { path: 'billing', element: <BillingPage /> },
          { path: 'exports', element: <ExportsPage /> },
          { path: 'notifications', element: <NotificationPreferencesPage /> },
        ],
      },
    ],
  },

  // ── Platform admin console (/platform/*) — separate from org app ──────────
  {
    path: '/platform',
    element: (
      <RequireAuth>
        <PlatformLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="organizations" replace /> },
      { path: 'organizations', element: <PlatformOrganizationsPage /> },
      { path: 'accounts', element: <PlatformAccountsPage /> },
      { path: 'diagnostics', element: <PlatformDiagnosticsPage /> },
      { path: 'billing', element: <PlatformBillingPage /> },
      { path: 'support-grants', element: <PlatformSupportGrantsPage /> },
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
      { path: 'pricing', element: <MarketingPricingPage /> },
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
