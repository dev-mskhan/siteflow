/**
 * CheckoutSuccessPage — /billing/checkout/success?organizationId=...
 *
 * Stripe redirects here after a successful payment. We immediately
 * invalidate the billing status cache and send the user into their org.
 * We do NOT trust any query params from Stripe for entitlement decisions
 * (the webhook + server-side reconciler is the source of truth).
 */
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useAppDispatch } from '../../app/store';
import { billingApi } from '../../features/billing/billingApi';

export const CheckoutSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get('organizationId');
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!orgId) {
      navigate('/onboarding', { replace: true });
      return;
    }

    // Invalidate billing status so the next render fetches fresh data
    dispatch(billingApi.util.invalidateTags([
      { type: 'Trial', id: orgId },
      { type: 'Subscription', id: orgId },
      { type: 'Invoice', id: orgId },
    ]));

    // Give the webhook ~3 seconds to land before redirecting to billing page
    const timer = setTimeout(() => {
      navigate(`/org/${orgId}/settings/billing`, { replace: true });
    }, 3000);

    return () => clearTimeout(timer);
  }, [orgId, navigate, dispatch]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[var(--surface)] px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <CheckCircle className="h-12 w-12 text-[#16a34a]" strokeWidth={1.5} />
        <h1 className="text-2xl font-medium tracking-tight">Payment successful</h1>
        <p className="text-sm text-[var(--muted)]">
          Your subscription is being activated. You'll be redirected to your billing page in a moment.
        </p>
        <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
      </div>
    </div>
  );
};
