import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowUpRight, Building2, Plus } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useListOrgsQuery } from '../../features/org/orgApi';
import { useAuth } from '../../features/auth/useAuth';
import { useAppDispatch } from '../../app/store';
import { orgContextCleared } from '../../features/org/orgSlice';

export const SelectOrgPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { data, isLoading } = useListOrgsQuery();
  const orgs = data?.organizations ?? [];

  const handleSelect = (orgId: string) => {
    dispatch(orgContextCleared());
    navigate(`/org/${orgId}/dashboard`, { replace: true });
  };

  return (
    <AuthLayout showPanel={false}>
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Your workspaces
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.04em]">
            Choose an organization
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {user?.firstName ? `Hi ${user.firstName}. ` : ''}
            You belong to multiple workspaces. Select one to continue.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse border border-[var(--hairline-2)] bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : (
          <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
            {orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSelect(org.id)}
                className="group w-full flex items-center justify-between gap-4 px-4 py-4 text-left hover:bg-[var(--surface-2)] transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface)]">
                    <Building2 className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--ink)] leading-tight">{org.name}</p>
                    <p className="font-mono text-[10px] text-[var(--muted)] mt-0.5">{org.slug}</p>
                  </div>
                </div>
                <ArrowUpRight
                  className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  strokeWidth={1.6}
                />
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-[var(--hairline-2)] pt-5">
          <Link
            to="/onboarding/create-org"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Create a new organization
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
