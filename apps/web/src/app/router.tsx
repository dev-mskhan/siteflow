import { createBrowserRouter } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { AppLayout } from './layouts/AppLayout';

// Public SEO & Marketing Pages
import HomePage from '../routes/home/HomePage';
import FeaturesPage from '../routes/marketing/FeaturesPage';
import PricingPage from '../routes/marketing/PricingPage';
import AboutPage from '../routes/marketing/AboutPage';
import ContactPage from '../routes/marketing/ContactPage';
import BlogPage from '../routes/marketing/BlogPage';

// Auth Pages & Scenarios
import LoginPage from '../routes/auth/LoginPage';
import RegisterPage from '../routes/auth/RegisterPage';
import ForgotPasswordPage from '../routes/auth/ForgotPasswordPage';
import ResetPasswordPage from '../routes/auth/ResetPasswordPage';
import VerifyEmailPage from '../routes/auth/VerifyEmailPage';
import TrialSignupPage from '../routes/auth/TrialSignupPage';
import AuthCompletePage from '../routes/auth/AuthCompletePage';
import AcceptInvitationPage from '../routes/auth/AcceptInvitationPage';

// Billing Callbacks
import CheckoutSuccessPage from '../routes/billing/CheckoutSuccessPage';
import CheckoutCancelPage from '../routes/billing/CheckoutCancelPage';

// Operational Feature Pages
import ProjectsPage from '../features/projects/pages/ProjectsPage';
import DashboardPage from '../features/dashboard/pages/DashboardPage';

// Standalone 404 Not Found Page
function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-bg text-text" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-surface-2 border border-border text-accent-1 text-2xl font-mono font-black mb-4">
        404
      </div>
      <h1 className="text-3xl font-black text-text">Page Not Found</h1>
      <p className="text-sm text-text-muted max-w-sm mt-2 mb-6">
        The drawing or URL you requested does not exist or has been relocated in the SiteFlow workspace.
      </p>
      <a href="/" className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-brand text-white shadow" style={{ background: 'var(--gradient-brand)' }}>
        Return to Safety (Home)
      </a>
    </div>
  );
}

export const router = createBrowserRouter([
  // ─── Public SEO & Marketing Pages ───
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/features', element: <FeaturesPage /> },
      { path: '/pricing', element: <PricingPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/contact', element: <ContactPage /> },
      { path: '/blog', element: <BlogPage /> },
    ],
  },

  // ─── Authentication, Onboarding & Invitations ───
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/trial', element: <TrialSignupPage /> },
      { path: '/auth/complete', element: <AuthCompletePage /> },
      { path: '/accept-invitation', element: <AcceptInvitationPage /> },
      { path: '/billing/checkout/success', element: <CheckoutSuccessPage /> },
      { path: '/billing/checkout/cancel', element: <CheckoutCancelPage /> },
    ],
  },

  // ─── Protected Operations App Shell ───
  {
    element: <AppLayout />,
    children: [
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/schedule', element: <ProjectsPage /> },
      { path: '/daily-logs', element: <ProjectsPage /> },
      { path: '/procurement', element: <ProjectsPage /> },
      { path: '/inventory', element: <ProjectsPage /> },
      { path: '/documents', element: <ProjectsPage /> },
      { path: '/quality-safety', element: <ProjectsPage /> },
      { path: '/commercial', element: <ProjectsPage /> },
      { path: '/reports', element: <ProjectsPage /> },
      { path: '/billing', element: <PricingPage /> },
      { path: '/settings', element: <AboutPage /> },
    ],
  },

  // ─── 404 Fallback ───
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
