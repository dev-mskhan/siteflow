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
  operatorUserId: string;
  organizationId: string;
  scopes: ('read:organizations' | 'write:billing' | 'admin')[];
  password: string;
  reasonCode: LifecycleReasonCode;
  reasonNote: string;
}

export interface WebhookInboxSummary {
  pending: number;
  failed: number;
  oldestPending: string | null;
}

export interface QueueDiagnostics {
  queueName: string;
  activeCount: number;
  waitingCount: number;
  completedCount: number;
  failedCount: number;
  windowHours: number;
}

export interface OrganizationDiagnostics {
  organizationId: string;
  memberCount: number;
  projectCount: number;
  storageUsedMB: number;
  apiCallsLast24h: number;
  lastActivityAt: string | null;
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
      query: ({ orgId }) => `/platform/organizations/${orgId}/billing`,
      transformResponse: (raw: { data: OrganizationBillingView }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'PlatformBilling', id: orgId }],
    }),

    getWebhookInbox: build.query<WebhookInboxSummary, void>({
      query: () => '/platform/billing/webhook-inbox',
      transformResponse: (raw: { data: WebhookInboxSummary }) => raw.data,
      providesTags: ['PlatformBilling'],
    }),

    triggerWebhookRecovery: build.mutation<{ status: string }, LifecycleInput>({
      query: (input) => ({
        url: '/platform/billing/webhook-recovery',
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { status: string } }) => raw.data,
      invalidatesTags: ['PlatformBilling'],
    }),

    // ── Diagnostics ────────────────────────────────────────────────────────

    getHealth: build.query<HealthView, void>({
      query: () => '/platform/diagnostics/health',
      transformResponse: (raw: { data: HealthView }) => raw.data,
      providesTags: ['PlatformDiagnostics'],
    }),

    getQueueDiagnostics: build.query<QueueDiagnostics, { windowHours?: number }>({
      query: ({ windowHours = 24 }) => ({
        url: '/platform/diagnostics/queue',
        params: { windowHours },
      }),
      transformResponse: (raw: { data: QueueDiagnostics }) => raw.data,
      providesTags: ['PlatformDiagnostics'],
    }),

    getOrganizationDiagnostics: build.query<OrganizationDiagnostics, { orgId: string }>({
      query: ({ orgId }) => `/platform/organizations/${orgId}/diagnostics`,
      transformResponse: (raw: { data: OrganizationDiagnostics }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'PlatformDiagnostics', id: orgId }],
    }),

    replayOutboxEvent: build.mutation<{ status: string }, { eventId: string }>({
      query: ({ eventId }) => ({
        url: `/platform/diagnostics/outbox/${eventId}/replay`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { status: string } }) => raw.data,
      invalidatesTags: ['PlatformDiagnostics'],
    }),

    // ── Account Lifecycle ──────────────────────────────────────────────────

    suspendAccount: build.mutation<{ status: string }, { userId: string; input: LifecycleInput }>({
      query: ({ userId, input }) => ({
        url: `/platform/accounts/${userId}/suspend`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { status: string } }) => raw.data,
      invalidatesTags: ['PlatformAccount'],
    }),

    reactivateAccount: build.mutation<{ status: string }, { userId: string; input: LifecycleInput }>({
      query: ({ userId, input }) => ({
        url: `/platform/accounts/${userId}/reactivate`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { status: string } }) => raw.data,
      invalidatesTags: ['PlatformAccount'],
    }),

    // ── Organization Suspension Flow ───────────────────────────────────────

    requestOrganizationSuspension: build.mutation<
      { approvalId: string },
      { orgId: string; input: LifecycleInput }
    >({
      query: ({ orgId, input }) => ({
        url: `/platform/organizations/${orgId}/suspension-requests`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { approvalId: string } }) => raw.data,
      invalidatesTags: ['PlatformOrg'],
    }),

    approveOrganizationSuspension: build.mutation<
      { status: string },
      { approvalId: string; input: LifecycleInput }
    >({
      query: ({ approvalId, input }) => ({
        url: `/platform/approvals/${approvalId}/approve`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { status: string } }) => raw.data,
      invalidatesTags: ['PlatformOrg'],
    }),

    // ── Support Grants ─────────────────────────────────────────────────────

    requestSupportGrant: build.mutation<{ grantId: string; status: string }, SupportGrantRequestInput>({
      query: (input) => ({
        url: '/platform/support-grants',
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { grantId: string; status: string } }) => raw.data,
      invalidatesTags: ['SupportGrant'],
    }),

    approveSupportGrant: build.mutation<
      { grantId: string; expiresAt: string },
      { grantId: string; password: string; durationMinutes: number }
    >({
      query: ({ grantId, password, durationMinutes }) => ({
        url: `/platform/support-grants/${grantId}/approve`,
        method: 'POST',
        body: { password, durationMinutes },
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { grantId: string; expiresAt: string } }) => raw.data,
      invalidatesTags: ['SupportGrant'],
    }),

    revokeSupportGrant: build.mutation<
      { status: string },
      { grantId: string; password: string }
    >({
      query: ({ grantId, password }) => ({
        url: `/platform/support-grants/${grantId}/revoke`,
        method: 'POST',
        body: { password },
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { status: string } }) => raw.data,
      invalidatesTags: ['SupportGrant'],
    }),

    useSupportGrant: build.query<
      { organizationId: string; scope: string; data: unknown },
      { grantId: string; scope: string }
    >({
      query: ({ grantId, scope }) => ({
        url: `/platform/support-grants/${grantId}/organization`,
        params: { scope },
      }),
      transformResponse: (raw: { data: { organizationId: string; scope: string; [key: string]: unknown } }) =>
        raw.data,
      providesTags: ['SupportGrant'],
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
  useGetWebhookInboxQuery,
  useTriggerWebhookRecoveryMutation,
  useGetHealthQuery,
  useGetQueueDiagnosticsQuery,
  useGetOrganizationDiagnosticsQuery,
  useReplayOutboxEventMutation,
  useSuspendAccountMutation,
  useReactivateAccountMutation,
  useRequestOrganizationSuspensionMutation,
  useApproveOrganizationSuspensionMutation,
  useRequestSupportGrantMutation,
  useApproveSupportGrantMutation,
  useRevokeSupportGrantMutation,
  useUseSupportGrantQuery,
} = platformApi;
