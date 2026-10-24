/**
 * platformApi — Platform admin console RTK Query slice.
 *
 * Base URL: /api/v1/platform (mounted at app-level, not org-scoped)
 * All writes require password re-entry body: { password, reasonCode, reasonNote }
 * Idempotency keys generated as UUID for all mutations.
 *
 * Permissions (platform RBAC, not org):
 *   read:organizations, read:billing, write:billing_sync,
 *   read:diagnostics, write:outbox_replay, write:organization_lifecycle,
 *   manage:support_grants, use:support_grant
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  PlatformOrgRow, PlatformAccountRow,
  LifecycleInput, LifecycleReasonCode,
  OrganizationBillingView, WebhookInboxSummary,
  HealthView, QueueDiagnosticsView, OrganizationDiagnosticsView,
  SupportGrantRequestInput, SupportGrantApproveInput, SupportGrantRevokeInput,
  SupportGrantScope,
} from '../types/platformTypes';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_ORGS: PlatformOrgRow[] = [
  { id: 'org_01', name: 'Mehmood Civil Construction', slug: 'mehmood-civil', status: 'ACTIVE', createdAt: '2024-01-01T00:00:00.000Z', memberCount: 5, ownerUserId: 'usr_01', ownerEmailMasked: 't***@company.com' },
  { id: 'org_02', name: 'Acme Construction Ltd', slug: 'acme-construction', status: 'ACTIVE', createdAt: '2024-03-15T00:00:00.000Z', memberCount: 12, ownerUserId: 'usr_05', ownerEmailMasked: 'j***@acme.com' },
  { id: 'org_03', name: 'Gulf Builders LLC', slug: 'gulf-builders', status: 'SUSPENDED', createdAt: '2024-02-20T00:00:00.000Z', memberCount: 3, ownerUserId: 'usr_08', ownerEmailMasked: 'a***@gulf.com' },
];

const MOCK_ACCOUNTS: PlatformAccountRow[] = [
  { id: 'usr_01', emailMasked: 't***@company.com', firstName: 'Tariq', lastName: 'Mehmood', status: 'ACTIVE', emailVerified: true, lastLoginAt: '2024-10-20T08:00:00.000Z', createdAt: '2024-01-01T00:00:00.000Z', membershipCount: 1 },
  { id: 'usr_02', emailMasked: 's***@company.com', firstName: 'Sara', lastName: 'Khan', status: 'ACTIVE', emailVerified: true, lastLoginAt: '2024-10-19T14:00:00.000Z', createdAt: '2024-01-05T00:00:00.000Z', membershipCount: 1 },
  { id: 'usr_05', emailMasked: 'j***@acme.com', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', emailVerified: true, lastLoginAt: '2024-10-18T10:00:00.000Z', createdAt: '2024-03-15T00:00:00.000Z', membershipCount: 1 },
  { id: 'usr_08', emailMasked: 'a***@gulf.com', firstName: 'Ahmed', lastName: 'Ali', status: 'SUSPENDED', emailVerified: false, lastLoginAt: '2024-09-01T00:00:00.000Z', createdAt: '2024-02-20T00:00:00.000Z', membershipCount: 1 },
];

export const platformApi = createApi({
  reducerPath: 'platformApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['PlatformOrg', 'PlatformAccount', 'PlatformBilling', 'PlatformDiagnostics', 'SupportGrant'],
  endpoints: (build) => ({

    // ── Read: Organizations + Accounts ──────────────────────────────────────

    listOrganizations: build.query<{ organizations: PlatformOrgRow[]; nextCursor: string | null }, { search?: string }>({
      queryFn: async ({ search }) => {
        await delay();
        let items = [...MOCK_ORGS];
        if (search) items = items.filter((o) => o.slug.toLowerCase().startsWith(search.toLowerCase()));
        return { data: { organizations: items, nextCursor: null } };
      },
      providesTags: ['PlatformOrg'],
    }),

    listAccounts: build.query<{ accounts: PlatformAccountRow[]; nextCursor: string | null }, { emailPrefix?: string }>({
      queryFn: async ({ emailPrefix }) => {
        await delay();
        let items = [...MOCK_ACCOUNTS];
        if (emailPrefix) items = items.filter((a) => a.emailMasked.toLowerCase().includes(emailPrefix.toLowerCase()));
        return { data: { accounts: items, nextCursor: null } };
      },
      providesTags: ['PlatformAccount'],
    }),

    // ── Lifecycle: Suspend / Reactivate ─────────────────────────────────────

    suspendAccount: build.mutation<{ status: string }, { userId: string } & LifecycleInput>({
      queryFn: async ({ userId }) => {
        await delay(250);
        const idx = MOCK_ACCOUNTS.findIndex((a) => a.id === userId);
        if (idx === -1) return { error: { status: 404, error: 'ACCOUNT_NOT_FOUND' } };
        if (MOCK_ACCOUNTS[idx]!.status === 'SUSPENDED') return { error: { status: 409, error: 'ACCOUNT_ALREADY_SUSPENDED' } };
        if (userId === 'usr_01') return { error: { status: 403, error: 'CANNOT_SUSPEND_SELF' } };
        MOCK_ACCOUNTS[idx] = { ...MOCK_ACCOUNTS[idx]!, status: 'SUSPENDED' };
        return { data: { status: 'SUSPENDED' } };
      },
      invalidatesTags: ['PlatformAccount'],
    }),

    reactivateAccount: build.mutation<{ status: string }, { userId: string } & LifecycleInput>({
      queryFn: async ({ userId }) => {
        await delay(250);
        const idx = MOCK_ACCOUNTS.findIndex((a) => a.id === userId);
        if (idx === -1) return { error: { status: 404, error: 'ACCOUNT_NOT_FOUND' } };
        if (MOCK_ACCOUNTS[idx]!.status !== 'SUSPENDED') return { error: { status: 409, error: 'ACCOUNT_NOT_SUSPENDED' } };
        MOCK_ACCOUNTS[idx] = { ...MOCK_ACCOUNTS[idx]!, status: 'ACTIVE' };
        return { data: { status: 'ACTIVE' } };
      },
      invalidatesTags: ['PlatformAccount'],
    }),

    requestOrgSuspension: build.mutation<{ approvalId: string }, { orgId: string } & LifecycleInput>({
      queryFn: async () => {
        await delay(250);
        return { data: { approvalId: `appr_${Date.now()}` } };
      },
      invalidatesTags: ['PlatformOrg'],
    }),

    approveOrgSuspension: build.mutation<{ status: string }, { approvalId: string } & LifecycleInput>({
      queryFn: async ({ approvalId }) => {
        await delay(250);
        // In mock: just mark a random org as suspended
        const idx = MOCK_ORGS.findIndex((o) => o.status === 'ACTIVE');
        if (idx !== -1) MOCK_ORGS[idx] = { ...MOCK_ORGS[idx]!, status: 'SUSPENDED' };
        return { data: { status: 'SUSPENDED' } };
      },
      invalidatesTags: ['PlatformOrg'],
    }),

    reactivateOrg: build.mutation<{ status: string }, { orgId: string } & LifecycleInput>({
      queryFn: async ({ orgId }) => {
        await delay(250);
        const idx = MOCK_ORGS.findIndex((o) => o.id === orgId);
        if (idx === -1) return { error: { status: 404, error: 'ORG_NOT_FOUND' } };
        if (MOCK_ORGS[idx]!.status !== 'SUSPENDED') return { error: { status: 409, error: 'ORG_NOT_SUSPENDED' } };
        MOCK_ORGS[idx] = { ...MOCK_ORGS[idx]!, status: 'ACTIVE' };
        return { data: { status: 'ACTIVE' } };
      },
      invalidatesTags: ['PlatformOrg'],
    }),

    // ── Billing ──────────────────────────────────────────────────────────────

    getOrgBilling: build.query<OrganizationBillingView, { orgId: string }>({
      queryFn: async ({ orgId }) => {
        await delay(200);
        return {
          data: {
            organizationId: orgId,
            subscription: {
              subscriptionId: 'sub_01', status: 'ACTIVE', planName: 'Professional',
              graceStartsAt: null, amountCents: 14900, currency: 'usd',
            },
            invoices: [
              { id: 'inv_01', status: 'PAID', amountDueCents: 0, currency: 'usd', createdAt: '2024-10-01T00:00:00.000Z', paymentAttemptCount: 1 },
              { id: 'inv_02', status: 'OPEN', amountDueCents: 14900, currency: 'usd', createdAt: '2024-11-01T00:00:00.000Z', paymentAttemptCount: 0 },
            ],
          },
        };
      },
      providesTags: ['PlatformBilling'],
    }),

    getWebhookInbox: build.query<WebhookInboxSummary, void>({
      queryFn: async () => {
        await delay(150);
        return { data: { counts: { PENDING: 2, RETRY: 0, PROCESSING: 0, FAILED: 1, QUARANTINED: 0 } } };
      },
      providesTags: ['PlatformBilling'],
    }),

    triggerWebhookRecovery: build.mutation<{ processedCount: number }, LifecycleInput>({
      queryFn: async () => {
        await delay(300);
        return { data: { processedCount: 3 } };
      },
      invalidatesTags: ['PlatformBilling'],
    }),

    // ── Diagnostics ───────────────────────────────────────────────────────────

    getHealth: build.query<HealthView, void>({
      queryFn: async () => {
        await delay(100);
        return { data: { status: 'ok', database: { ok: true, latencyMs: 3 }, checkedAt: new Date().toISOString() } };
      },
      providesTags: ['PlatformDiagnostics'],
    }),

    getQueueDiagnostics: build.query<QueueDiagnosticsView, { windowHours?: number }>({
      queryFn: async ({ windowHours = 24 }) => {
        await delay(200);
        return {
          data: {
            windowHours,
            counts: { created: 15, retry: 2, active: 1, completed: 142, cancelled: 3, failed: 1 },
            oldestWaitingJobAgeSeconds: 45,
            webhookInbox: { PENDING: 2, RETRY: 0, PROCESSING: 0, FAILED: 1, QUARANTINED: 0 },
            outbox: {
              failedCount: 1,
              oldestFailedAt: '2024-10-19T14:00:00.000Z',
              failed: [
                { id: 'ob_01', eventType: 'project.change_order.effected', organizationId: 'org_02', retryCount: 3, createdAt: '2024-10-19T14:00:00.000Z' },
              ],
            },
          },
        };
      },
      providesTags: ['PlatformDiagnostics'],
    }),

    getOrgDiagnostics: build.query<OrganizationDiagnosticsView, { orgId: string }>({
      queryFn: async ({ orgId }) => {
        await delay(200);
        return {
          data: {
            organizationId: orgId,
            notificationDeliveries: { PENDING: 0, DELIVERED: 45, FAILED: 2, CANCELLED: 1 },
            storageBytes: 15_728_640,
          },
        };
      },
      providesTags: ['PlatformDiagnostics'],
    }),

    replayOutboxEvent: build.mutation<{ status: string }, { eventId: string }>({
      queryFn: async () => {
        await delay(200);
        return { data: { status: 'PENDING' } };
      },
      invalidatesTags: ['PlatformDiagnostics'],
    }),

    // ── Support Grants ───────────────────────────────────────────────────────

    requestSupportGrant: build.mutation<{ grantId: string }, SupportGrantRequestInput>({
      queryFn: async () => {
        await delay(250);
        return { data: { grantId: `grant_${Date.now()}` } };
      },
      invalidatesTags: ['SupportGrant'],
    }),

    approveSupportGrant: build.mutation<{ expiresAt: string }, { grantId: string } & SupportGrantApproveInput>({
      queryFn: async ({ durationMinutes }) => {
        await delay(250);
        const expires = new Date(Date.now() + durationMinutes * 60000).toISOString();
        return { data: { expiresAt: expires } };
      },
      invalidatesTags: ['SupportGrant'],
    }),

    revokeSupportGrant: build.mutation<{ status: string }, { grantId: string } & SupportGrantRevokeInput>({
      queryFn: async () => {
        await delay(200);
        return { data: { status: 'revoked' } };
      },
      invalidatesTags: ['SupportGrant'],
    }),

    useSupportGrant: build.query<{ organizationId: string; scope: SupportGrantScope; [key: string]: unknown }, { grantId: string; scope: SupportGrantScope }>({
      queryFn: async ({ scope }) => {
        await delay(200);
        if (scope === 'read:org_summary') {
          return { data: { organizationId: 'org_02', scope, organization: { id: 'org_02', name: 'Acme Construction Ltd', slug: 'acme-construction', status: 'ACTIVE', ownerEmailMasked: 'j***@acme.com', memberCount: 12 } } };
        }
        if (scope === 'read:org_subscription') {
          return { data: { organizationId: 'org_02', scope, subscription: { subscriptionId: 'sub_02', status: 'ACTIVE', planName: 'Professional', amountDueCents: 14900, currency: 'usd' } } };
        }
        return { data: { organizationId: 'org_02', scope, entitlements: { maxProjects: 100, maxMembers: 50, aiInsights: true } } };
      },
      providesTags: ['SupportGrant'],
    }),
  }),
});

export const {
  useListOrganizationsQuery,
  useListAccountsQuery,
  useSuspendAccountMutation,
  useReactivateAccountMutation,
  useRequestOrgSuspensionMutation,
  useApproveOrgSuspensionMutation,
  useReactivateOrgMutation,
  useGetOrgBillingQuery,
  useGetWebhookInboxQuery,
  useTriggerWebhookRecoveryMutation,
  useGetHealthQuery,
  useGetQueueDiagnosticsQuery,
  useGetOrgDiagnosticsQuery,
  useReplayOutboxEventMutation,
  useRequestSupportGrantMutation,
  useApproveSupportGrantMutation,
  useRevokeSupportGrantMutation,
  useUseSupportGrantQuery,
} = platformApi;
