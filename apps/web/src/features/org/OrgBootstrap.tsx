import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useGetOrgQuery } from './orgApi';
import { useListMembersQuery } from './memberApi';
import { useAppDispatch, useAppSelector } from '../../app/store';
import { orgContextLoaded, orgInitializedEmpty, orgLoadingStarted } from './orgSlice';
import { derivePermissions } from '../../lib/permissions';

interface OrgBootstrapProps {
  children: React.ReactNode;
}

// ── Real bootstrap — fires API calls, populates orgSlice ──────────────────────
const OrgBootstrapReal: React.FC<OrgBootstrapProps> = ({ children }) => {
  const { orgId } = useParams<{ orgId: string }>();
  const dispatch = useAppDispatch();
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const { isOrgInitialized, activeOrg } = useAppSelector((s) => s.org);

  // Detect org switch — reset when :orgId changes
  useEffect(() => {
    if (orgId && activeOrg?.id !== orgId) {
      dispatch(orgLoadingStarted());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const {
    data: orgData,
    isLoading: orgLoading,
    isError: orgError,
  } = useGetOrgQuery(orgId!, { skip: !orgId || isOrgInitialized });

  const {
    data: membersData,
    isLoading: membersLoading,
    isError: membersError,
  } = useListMembersQuery(orgId!, { skip: !orgId || isOrgInitialized });

  useEffect(() => {
    if (!orgId || !currentUserId) return;
    if (orgLoading || membersLoading) return;

    if (orgError || membersError || !orgData || !membersData) {
      dispatch(orgInitializedEmpty());
      return;
    }

    const mine = membersData.members.find((m) => m.userId === currentUserId);
    if (!mine || mine.status === 'REMOVED') {
      dispatch(orgInitializedEmpty());
      return;
    }

    dispatch(
      orgContextLoaded({
        org: orgData.organization,
        membership: mine,
        permissions: derivePermissions(mine.roleName),
      }),
    );
  }, [
    orgId,
    currentUserId,
    orgLoading,
    membersLoading,
    orgError,
    membersError,
    orgData,
    membersData,
    dispatch,
  ]);

  if (!isOrgInitialized || orgLoading || membersLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-64px)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
      </div>
    );
  }

  return <>{children}</>;
};

// ── Bypass bootstrap — store already seeded, render children immediately ──────
// No API calls, no effects, no spinner. Used when VITE_DEV_BYPASS=true.
const OrgBootstrapBypass: React.FC<OrgBootstrapProps> = ({ children }) => <>{children}</>;

// ── Exported component — picks the right implementation at module init time ───
const BYPASS = import.meta.env.VITE_DEV_BYPASS === 'true';

export const OrgBootstrap: React.FC<OrgBootstrapProps> = BYPASS
  ? OrgBootstrapBypass
  : OrgBootstrapReal;
