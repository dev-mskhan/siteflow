/**
 * CheckoutSuccessPage — /billing/checkout/success
 *
 * Redirect target when Stripe Checkout completes successfully.
 * Per docs/api/billing-integration.md §3.1:
 * "On return, refresh subscription and trial state rather than trusting query string."
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { siteflowApi } from '../../lib/store/api';
import { useAppDispatch } from '../../lib/store/index';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const organizationId = searchParams.get('organizationId');

  useEffect(() => {
    // Invalidate billing tags so fresh subscription state is fetched
    dispatch(siteflowApi.util.invalidateTags(['Billing', 'Trial', 'Organization']));
  }, [dispatch]);

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-2"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid var(--success)' }}
        >
          ✓
        </div>
        <CardTitle className="text-2xl font-bold">Subscription Confirmed!</CardTitle>
        <CardDescription>
          Your SiteFlow plan has been activated. Thank you for partnering with us.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 py-4 text-xs text-text-muted">
        <p>
          Your organization features (estimating, CPM scheduling, BOQs, AIA G702 billing) are now unlocked.
        </p>
        {organizationId && (
          <p className="font-mono text-[11px] p-2 rounded bg-surface-2 border border-border">
            Org: {organizationId}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Button
          variant="primary"
          className="w-full"
          onClick={() => navigate('/projects', { replace: true })}
        >
          Launch Operations Workspace
        </Button>
        <Link to="/billing" className="text-xs text-text-muted hover:text-text">
          View Billing & Invoices
        </Link>
      </CardFooter>
    </Card>
  );
}
