/**
 * CheckoutCancelPage — /billing/checkout/cancel
 *
 * Redirect target when user cancels Stripe Checkout.
 * Per docs/api/billing-integration.md §3.1.
 */

import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function CheckoutCancelPage() {
  const navigate = useNavigate();

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-2 text-warning"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid var(--warning)' }}
        >
          !
        </div>
        <CardTitle className="text-2xl font-bold">Checkout Incomplete</CardTitle>
        <CardDescription>
          No payment was processed. Your previous plan and data remain untouched.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 py-4 text-xs text-text-muted">
        <p>
          You can continue exploring SiteFlow or upgrade your subscription anytime from the billing tab.
        </p>
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Button
          variant="primary"
          className="w-full"
          onClick={() => navigate('/pricing')}
        >
          Review Pricing & Plans
        </Button>
        <Link to="/projects" className="text-xs text-text-muted hover:text-text">
          Return to Projects
        </Link>
      </CardFooter>
    </Card>
  );
}
