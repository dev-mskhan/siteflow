import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useListOrgsQuery } from '../../features/org/orgApi';

export const OnboardingRouter: React.FC = () => {
  const { data, isLoading, isError } = useListOrgsQuery();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--surface)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
      </div>
    );
  }

  if (isError || !data) return <Navigate to="/login" replace />;

  const orgs = data.organizations;

  // Determine billing route based on plan choice
  const getBillingRoute = (orgId: string): string => {
    if (!planParam) {
      // No plan specified → show trial CTA
      return `/org/${orgId}/settings/billing?flow=trial`;
    }
    
    if (planParam === 'trial') {
      // Explicit trial choice → show trial CTA
      return `/org/${orgId}/settings/billing?flow=trial`;
    }
    
    if (['starter', 'professional', 'enterprise'].includes(planParam)) {
      // Paid plan choice → show checkout flow
      return `/org/${orgId}/settings/billing?flow=checkout&plan=${planParam}`;
    }
    
    // Fallback: show trial
    return `/org/${orgId}/settings/billing?flow=trial`;
  };

  if (orgs.length === 0) {
    const planSuffix = planParam ? `?plan=${planParam}` : '';
    return <Navigate to={`/onboarding/create-org${planSuffix}`} replace />;
  }
  
  if (orgs.length === 1) {
    return <Navigate to={getBillingRoute(orgs[0]!.id)} replace />;
  }
  
  const planSuffix = planParam ? `?plan=${planParam}` : '';
  return <Navigate to={`/onboarding/select-org${planSuffix}`} replace />;
};
