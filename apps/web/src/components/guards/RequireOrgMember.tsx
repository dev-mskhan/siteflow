/**
 * RequireOrgMember — verifies the current user has an active membership
 * in the org identified by :orgId in the URL.
 *
 * Checks (in order):
 *   1. isAuthenticated — if false, RequireAuth above already redirected to /login
 *   2. isOrgInitialized — if false, OrgBootstrap is still loading (spinner shown there)
 *   3. membership !== null — user is a member of this org
 *   4. membership.status !== 'REMOVED' — not removed
 *   5. If membership.status === 'SUSPENDED' — allow read-only access (permissions=[])
 *
 * On failure: renders NoAccessPage inline — never redirects to login.
 * The user is authenticated; they just don't belong to this workspace.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff, ArrowUpRight } from 'lucide-react';
import { useOrgContext } from '../../features/org/useOrgContext';

const NoAccessPage: React.FC = () => (
  <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-64px)] px-5">
    <div className="w-full max-w-md border border-[var(--hairline-2)] bg-[var(--paper)] p-10 text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
        <ShieldOff className="h-7 w-7 text-[var(--muted)]" strokeWidth={1.5} />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        Access denied
      </p>
      <h1 className="mt-3 text-xl font-medium tracking-[-0.03em]">
        You don't have access to this workspace
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        You are not a member of this organization, or your membership has been removed.
        Contact the workspace admin to request access.
      </p>
      <Link
        to="/onboarding"
        className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity"
      >
        Go to your workspaces
        <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
      </Link>
    </div>
  </div>
);

const SuspendedBanner: React.FC = () => (
  <div className="border-b border-[#fde68a] bg-[#fffbeb] px-5 py-2.5">
    <p className="text-sm text-[#92400e] text-center">
      Your membership in this workspace has been suspended. You can view data but cannot make changes.
      Contact the workspace admin.
    </p>
  </div>
);

export const RequireOrgMember: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOrgInitialized, membership } = useOrgContext();

  // OrgBootstrap hasn't settled yet — it shows its own spinner
  if (!isOrgInitialized) return null;

  // Not a member, or removed
  if (!membership || membership.status === 'REMOVED') {
    return <NoAccessPage />;
  }

  // Suspended — show banner but allow render (permissions=[] hides all actions)
  return (
    <>
      {membership.status === 'SUSPENDED' && <SuspendedBanner />}
      {children}
    </>
  );
};
