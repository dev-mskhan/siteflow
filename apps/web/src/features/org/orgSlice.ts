import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PermissionKey } from '../../lib/permissions';

// ─── DTO types (mirror server DTOs exactly) ───────────────────────────────────

export interface OrgDTO {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberDTO {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  roleName: string;
  userEmail: string;
  userFirstName: string;
  userLastName: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface OrgState {
  /** The org currently open in the URL (/org/:orgId/*) */
  activeOrg: OrgDTO | null;
  /** Current user's own membership inside activeOrg */
  membership: MemberDTO | null;
  /** Permission keys derived from membership.roleName via ROLE_PERMISSIONS map */
  permissions: PermissionKey[];
  /** True once OrgBootstrap has settled (success OR empty/error) */
  isOrgInitialized: boolean;
  /** True while OrgBootstrap API calls are in-flight */
  isOrgLoading: boolean;
}

const initialState: OrgState = {
  activeOrg: null,
  membership: null,
  permissions: [],
  isOrgInitialized: false,
  isOrgLoading: false,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    /** OrgBootstrap populated everything successfully */
    orgContextLoaded: (
      state,
      action: PayloadAction<{
        org: OrgDTO;
        membership: MemberDTO;
        permissions: PermissionKey[];
      }>,
    ) => {
      state.activeOrg = action.payload.org;
      state.membership = action.payload.membership;
      state.permissions = action.payload.permissions;
      state.isOrgInitialized = true;
      state.isOrgLoading = false;
    },
    /** Org not found, user not a member, or org suspended/archived */
    orgInitializedEmpty: (state) => {
      state.activeOrg = null;
      state.membership = null;
      state.permissions = [];
      state.isOrgInitialized = true;
      state.isOrgLoading = false;
    },
    /** org switch started — re-entering OrgBootstrap */
    orgLoadingStarted: (state) => {
      state.isOrgInitialized = false;
      state.isOrgLoading = true;
    },
    /** Full clear on logout */
    orgContextCleared: (state) => {
      state.activeOrg = null;
      state.membership = null;
      state.permissions = [];
      state.isOrgInitialized = false;
      state.isOrgLoading = false;
    },
    /** In-place name update after PATCH /organizations/:id succeeds */
    orgNameUpdated: (state, action: PayloadAction<string>) => {
      if (state.activeOrg) state.activeOrg.name = action.payload;
    },
  },
});

export const {
  orgContextLoaded,
  orgInitializedEmpty,
  orgLoadingStarted,
  orgContextCleared,
  orgNameUpdated,
} = orgSlice.actions;

export default orgSlice.reducer;
