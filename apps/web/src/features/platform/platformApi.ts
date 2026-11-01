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
import type {
  HealthView,
  LifecycleInput,
  LifecycleReasonCode,
  OrganizationBillingView,
  OrganizationDiagnosticsView,
  PlatformAccountRow,
  PlatformOrgRow,
  QueueDiagnosticsView,
  SupportGrantRequestInput,
  SupportGrantScope,
  WebhookInboxSummary,
} from '../../types/platformTypes';

export type {
  LifecycleInput,
  LifecycleReasonCode,
  PlatformAccountRow,
  PlatformOrgRow,
  SupportGrantRequestInput,
};

interface SupportGrantView {
  organizationId: string;
  scope: SupportGrantScope;
  organization?: unknown;
  subscription?: unknown;
  entitlements?: unknown;
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
      transformResponse: (raw: { data: { organizations: PlatformOrgRow[] }; meta: { nextCursor: string | null } }) => ({
        organizations: raw.data.organizations,
        nextCursor: raw.meta.nextCursor,
      }),
      providesTags: ['PlatformOrg'],
    }),

    listAccounts: build.query<
      { accounts: PlatformAccountRow[]; nextCursor: string | null },
      { emailPrefix?: string; cursor?: string }
    >({
      query: ({ emailPrefix, cursor }) => {
        const params = new URLSearchParams();
        if (emailPrefix) params.set('emailPrefix', emailPrefix);
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/platform/accounts${query}`;
      },
      transformResponse: (raw: { data: { accounts: PlatformAccountRow[] }; meta: { nextCursor: string | null } }) => ({
        accounts: raw.data.accounts,
        nextCursor: raw.meta.nextCursor,
      }),
      providesTags: ['PlatformAccount'],
    }),

    // ── Lifecycle Operations ───────────────────────────────────────────────

    reactivateOrganization: build.mutation<void, { orgId: string; input: LifecycleInput }>({
      query: ({ orgId, input }) => ({
        url: `/platform/organizations/${orgId}/reactivate`,
        method: 'POST',
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

    triggerWebhookRecovery: build.mutation<{ processedCount: number }, LifecycleInput>({
      query: (input) => ({
        url: '/platform/billing/webhook-recovery',
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { processedCount: number } }) => raw.data,
      invalidatesTags: ['PlatformBilling'],
    }),

    // ── Diagnostics ────────────────────────────────────────────────────────

    getHealth: build.query<HealthView, void>({
      query: () => '/platform/diagnostics/health',
      transformResponse: (raw: { data: HealthView }) => raw.data,
      providesTags: ['PlatformDiagnostics'],
    }),

    getQueueDiagnostics: build.query<QueueDiagnosticsView, { windowHours?: number }>({
      query: ({ windowHours = 24 }) => ({
        url: '/platform/diagnostics/queue',
        params: { windowHours },
      }),
      transformResponse: (raw: { data: QueueDiagnosticsView }) => raw.data,
      providesTags: ['PlatformDiagnostics'],
    }),

    getOrganizationDiagnostics: build.query<OrganizationDiagnosticsView, { orgId: string }>({
      query: ({ orgId }) => `/platform/organizations/${orgId}/diagnostics`,
      transformResponse: (raw: { data: OrganizationDiagnosticsView }) => raw.data,
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

    requestSupportGrant: build.mutation<{ grantId: string }, SupportGrantRequestInput>({
      query: (input) => ({
        url: '/platform/support-grants',
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { grantId: string } }) => raw.data,
      invalidatesTags: ['SupportGrant'],
    }),

    approveSupportGrant: build.mutation<
      { expiresAt: string },
      { grantId: string; password: string; durationMinutes: number }
    >({
      query: ({ grantId, password, durationMinutes }) => ({
        url: `/platform/support-grants/${grantId}/approve`,
        method: 'POST',
        body: { password, durationMinutes },
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { expiresAt: string } }) => raw.data,
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

    useSupportGrant: build.query<SupportGrantView, { grantId: string; scope: SupportGrantScope }>({
      query: ({ grantId, scope }) => ({
        url: `/platform/support-grants/${grantId}/organization`,
        params: { scope },
      }),
      transformResponse: (raw: { data: SupportGrantView }) =>
        raw.data,
      providesTags: ['SupportGrant'],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListOrganizationsQuery,
  useListAccountsQuery,
  useReactivateOrganizationMutation,
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
