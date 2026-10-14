/**
 * DevTestProvider — DEV-ONLY bypass for testing dashboard screens.
 *
 * Activated only when VITE_DEV_BYPASS=true in .env.local.
 * Seeds authSlice + orgSlice + projectSlice with realistic mock data
 * so any /org/:orgId/* or /org/:orgId/projects/:projectId/* URL
 * loads without needing a real server session.
 *
 * HOW TO USE:
 *   1. Create apps/web/.env.local with:  VITE_DEV_BYPASS=true
 *   2. Start dev server:                 pnpm dev (from apps/web)
 *   3. Navigate to any of these URLs:
 *
 *   Dashboard:
 *     http://localhost:3001/org/org_01/dashboard
 *
 *   Members:
 *     http://localhost:3001/org/org_01/members
 *
 *   Projects list:
 *     http://localhost:3001/org/org_01/projects
 *
 *   Project detail (Gulberg Commercial Plaza):
 *     http://localhost:3001/org/org_01/projects/proj_01
 *     http://localhost:3001/org/org_01/projects/proj_01/phases
 *     http://localhost:3001/org/org_01/projects/proj_01/cost-codes
 *     http://localhost:3001/org/org_01/projects/proj_01/budget
 *     http://localhost:3001/org/org_01/projects/proj_01/team
 *     http://localhost:3001/org/org_01/projects/proj_01/settings
 *
 *   Project detail (DHA Villas — budget DRAFT):
 *     http://localhost:3001/org/org_01/projects/proj_02
 *
 *   Project detail (Ring Road — DRAFT status, no budget):
 *     http://localhost:3001/org/org_01/projects/proj_03
 *
 *   Org settings:
 *     http://localhost:3001/org/org_01/settings
 *     http://localhost:3001/org/org_01/settings/profile
 *     http://localhost:3001/org/org_01/settings/sequences
 *     http://localhost:3001/org/org_01/settings/audit
 *
 * NEVER import this in production code. It is tree-shaken out when
 * VITE_DEV_BYPASS is not set.
 */

import React, { useEffect } from 'react';
import { useAppDispatch } from '../app/store';
import { authUserLoaded } from '../features/auth/authSlice';
import { orgContextLoaded } from '../features/org/orgSlice';
import { ROLE_PERMISSIONS } from '../lib/permissions';
import type { UserDTO } from '@siteflow/shared';
import type { OrgDTO, MemberDTO } from '../features/org/orgSlice';

// ── Mock user (Organization Admin) ───────────────────────────────────────────
const DEV_USER: UserDTO = {
  id: 'usr_01',
  email: 'tariq@company.com',
  firstName: 'Tariq',
  lastName: 'Mehmood',
  status: 'ACTIVE',
  emailVerified: true,
  lastLoginAt: new Date().toISOString(),
  createdAt: '2024-01-01T00:00:00.000Z',
};

// ── Mock org ─────────────────────────────────────────────────────────────────
const DEV_ORG: OrgDTO = {
  id: 'org_01',
  name: 'Mehmood Civil Construction',
  slug: 'mehmood-civil',
  status: 'ACTIVE',
  createdBy: 'usr_01',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// ── Mock membership (Organization Admin — has every permission) ───────────────
const DEV_MEMBERSHIP: MemberDTO = {
  id: 'mem_01',
  organizationId: 'org_01',
  userId: 'usr_01',
  roleId: 'role_admin_01',
  roleName: 'Organization Admin',
  userEmail: 'tariq@company.com',
  userFirstName: 'Tariq',
  userLastName: 'Mehmood',
  status: 'ACTIVE',
  joinedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// ── Seeder component ─────────────────────────────────────────────────────────
const DevSeeder: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Seed auth state — makes RequireAuth pass
    dispatch(authUserLoaded(DEV_USER));

    // Seed org state — makes RequireOrgMember + OrgBootstrap pass
    dispatch(orgContextLoaded({
      org: DEV_ORG,
      membership: DEV_MEMBERSHIP,
      permissions: ROLE_PERMISSIONS['Organization Admin'] ?? [],
    }));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
};

// ── Exported provider — only renders seeder when VITE_DEV_BYPASS is true ─────
export const DevTestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const bypass = import.meta.env.VITE_DEV_BYPASS === 'true';
  if (!bypass) return <>{children}</>;
  return <DevSeeder>{children}</DevSeeder>;
};
