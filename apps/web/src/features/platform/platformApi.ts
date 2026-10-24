/**
 * platformApi — Live integration for platform admin operations.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Platform-level operations (not org-scoped):
 *   - Organization & account management
 *   - Billing sync & diagnostics
 *   - Support grants
 *
 * All mutations require password re-entry in body: { password, reasonCode, reasonNote }
 */
import { baseApi } from '../../services/baseApi';

export interface PlatformOrgRow {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  memberCount: number;
  ownerUserId: string;
  ownerEmailMasked: string;
}

export interface PlatformAccountRow {
  id: string;
  emailMasked: string;
  firstName: string | null;
  lastName: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  membershipCount: number;
}

export interface OrganizationBillingView {
  organizationId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planTier: string | null;
  status: string | null;
  trialStatus: string | null;
  trialExpiresAt: string | null;
}

export interface HealthView {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  timestamp: string;
  services: Record<string, { status: string; latency?: number }>;
}

export type LifecycleReasonCode = 'PAYMENT_FAILURE' | 'ABUSE' | 'GDPR_REQUEST' | 'SUPPORT' | 'OTHER';

export interface LifecycleInput {
  password: string;
  reasonCode: LifecycleReasonCode;
  reasonNote: string;
}

export interface SupportGrantRequestInput {
  organizationId: string;
  scope: 'read' | 'write' | 'admin';
  durationHours: number;
  reason: string;
}

export const platformApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Organizations & Accounts ───────────────────────────────────────────

    listOrganizations: build.query<
      { organizations: PlatformOrgRow[]; nextCursor: string | null },
      { search?: string; cursor?: string }
    >({
      query: ({ search, cursor }) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/platform/organizations${query}`;
      },
      transformResponse: (raw: { data: PlatformOrgRow[]; meta: { nextCursor: string | null } }) => ({
        organizations: raw.data,
        nextCursor: raw.meta.nextCursor,
      }),
      providesTags: ['PlatformOrg'],
    }),

    listAccounts: build.query<
      { accounts: PlatformAccountRow[]; nextCursor: string | null },
      { search?: string; cursor?: string }
    >({
      query: ({ search, cursor }) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/platform/accounts${query}`;
      },
      transformResponse: (raw: { data: PlatformAccountRow[]; meta: { nextCursor: string | null } }) => ({
        accounts: raw.data,
        nextCursor: raw.meta.nextCursor,
      }),
      providesTags: ['PlatformAccount'],
    }),

    // ── Lifecycle Operations ───────────────────────────────────────────────

    suspendOrganization: build.mutation<void, { orgId: string; input: LifecycleInput }>({
      query: ({ orgId, input }) => ({
        url: `/platform/organizations/${orgId}/suspend`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: ['PlatformOrg'],
    }),

    reactivateOrganization: build.mutation<void, { orgId: string; input: LifecycleInput }>({
      query: ({ orgId, input }) => ({
        url: `/platform/organizations/${orgId}/reactivate`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: ['PlatformOrg'],
    }),

    deleteOrganization: build.mutation<void, { orgId: string; input: LifecycleInput }>({
      query: ({ orgId, input }) => ({
        url: `/platform/organizations/${orgId}`,
        method: 'DELETE',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: ['PlatformOrg'],
    }),

    // ── Billing View ───────────────────────────────────────────────────────

    getOrganizationBilling: build.query<OrganizationBillingView, { orgId: string }>({
      query: ({ orgId }) => `/platform/billing/${orgId}`,
      transformResponse: (raw: { data: OrganizationBillingView }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'PlatformBilling', id: orgId }],
    }),

    // ── Diagnostics ────────────────────────────────────────────────────────

    getHealth: build.query<HealthView, void>({
      query: () => '/platform/health',
      transformResponse: (raw: { data: HealthView }) => raw.data,
      providesTags: ['PlatformDiagnostics'],
    }),

    // ── Support Grants ─────────────────────────────────────────────────────

    requestSupportGrant: build.mutation<{ grantId: string }, SupportGrantRequestInput>({
      query: (input) => ({
        url: '/platform/support-grants/request',
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { grantId: string } }) => raw.data,
      invalidatesTags: ['SupportGrant'],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListOrganizationsQuery,
  useListAccountsQuery,
  useSuspendOrganizationMutation,
  useReactivateOrganizationMutation,
  useDeleteOrganizationMutation,
  useGetOrganizationBillingQuery,
  useGetHealthQuery,
  useRequestSupportGrantMutation,
} = platformApi;
