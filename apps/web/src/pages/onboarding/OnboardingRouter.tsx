import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useListOrgsQuery } from '../../features/org/orgApi';

export const OnboardingRouter: React.FC = () => {
  const { data, isLoading, isError } = useListOrgsQuery();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');
  const planSuffix = planParam ? `?plan=${planParam}` : '';

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--surface)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
      </div>
    );
  }

  if (isError || !data) return <Navigate to="/login" replace />;

  const orgs = data.organizations;

  if (orgs.length === 0) return <Navigate to={`/onboarding/create-org${planSuffix}`} replace />;
  if (orgs.length === 1) return <Navigate to={`/org/${orgs[0]!.id}/settings/billing${planSuffix}`} replace />;
  return <Navigate to={`/onboarding/select-org${planSuffix}`} replace />;
};
