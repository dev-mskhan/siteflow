/**
 * CheckoutCancelPage — /billing/checkout/cancel?organizationId=...
 *
 * User cancelled the Stripe Checkout session. Send them back to the
 * billing page so they can try again or choose a different plan.
 */
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export const CheckoutCancelPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get('organizationId');

  // Auto-redirect after 4 seconds if the user doesn't click the button
  useEffect(() => {
    if (!orgId) {
      navigate('/onboarding', { replace: true });
      return;
    }
    const timer = setTimeout(() => {
      navigate(`/org/${orgId}/settings/billing`, { replace: true });
    }, 4000);
    return () => clearTimeout(timer);
  }, [orgId, navigate]);

  const billingHref = orgId ? `/org/${orgId}/settings/billing` : '/onboarding';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[var(--surface)] px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <XCircle className="h-12 w-12 text-[var(--muted)]" strokeWidth={1.5} />
        <h1 className="text-2xl font-medium tracking-tight">Checkout cancelled</h1>
        <p className="text-sm text-[var(--muted)]">
          No charge was made. You can choose a plan and try again whenever you're ready.
        </p>
        <Link
          to={billingHref}
          className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white hover:-translate-y-0.5 transition-transform"
        >
          Back to billing
        </Link>
      </div>
    </div>
  );
};
