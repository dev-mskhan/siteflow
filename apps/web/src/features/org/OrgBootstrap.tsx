/**
 * OrgBootstrap — scoped to AppLayout, fires when :orgId is in the URL.
 *
 * Fires two RTK Query calls in parallel:
 *   1. GET /organizations/:orgId              → org name, slug, status
 *   2. GET /organizations/:orgId/members      → all members (list is small, bounded by tier)
 *      → finds the entry matching auth.user.id → current user's MemberDTO
 *      → derives permissions via ROLE_PERMISSIONS[roleName]
 *
 * Dispatches:
 *   orgContextLoaded   — happy path
 *   orgInitializedEmpty — org 404, user not a member, org suspended/archived
 *
 * Re-fires automatically when orgId URL param changes (org switch works for free).
 *
 * States rendered:
 *   loading           → <AppLoadingScreen /> (spinner inside app shell, not full-page)
 *   error / no access → dispatches orgInitializedEmpty → RequireOrgMember handles it
 *   success           → renders children
 */

import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useGetOrgQuery } from './orgApi';
import { useListMembersQuery } from './memberApi';
import { useAppDispatch, useAppSelector } from '../../app/store';
import {
  orgContextLoaded,
  orgInitializedEmpty,
  orgLoadingStarted,
} from './orgSlice';
import { derivePermissions } from '../../lib/permissions';

interface OrgBootstrapProps {
  children: React.ReactNode;
}

export const OrgBootstrap: React.FC<OrgBootstrapProps> = ({ children }) => {
  const { orgId } = useParams<{ orgId: string }>();
  const dispatch = useAppDispatch();
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const { isOrgInitialized, activeOrg } = useAppSelector((s) => s.org);

  // Signal that we are starting a new org load (handles org switch)
  useEffect(() => {
    if (orgId && activeOrg?.id !== orgId) {
      dispatch(orgLoadingStarted());
    }
  }, [orgId, activeOrg?.id, dispatch]);

  const {
    data: orgData,
    isLoading: orgLoading,
    isError: orgError,
  } = useGetOrgQuery(orgId!, { skip: !orgId });

  const {
    data: membersData,
    isLoading: membersLoading,
    isError: membersError,
  } = useListMembersQuery(orgId!, { skip: !orgId });

  useEffect(() => {
    if (!orgId || !currentUserId) return;

    // Still loading — wait
    if (orgLoading || membersLoading) return;

    // Any API error → empty context (RequireOrgMember will show NoAccess)
    if (orgError || membersError || !orgData || !membersData) {
      dispatch(orgInitializedEmpty());
      return;
    }

    // Find current user's membership in the list
    const myMembership = membersData.members.find((m) => m.userId === currentUserId);

    if (!myMembership || myMembership.status === 'REMOVED') {
      dispatch(orgInitializedEmpty());
      return;
    }

    // Derive permissions from role name (mirrors DEFAULT_ORG_ROLES on server)
    const permissions = derivePermissions(myMembership.roleName);

    dispatch(
      orgContextLoaded({
        org: orgData.organization,
        membership: myMembership,
        permissions,
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

  // Show spinner inside app shell while loading
  if (!isOrgInitialized || orgLoading || membersLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-64px)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
      </div>
    );
  }

  return <>{children}</>;
};
