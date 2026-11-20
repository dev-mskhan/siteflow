/**
 * billingApi — Live integration for SaaS billing and subscription management.
 */
import { baseApi } from '../../services/baseApi';
import type { TrialDTO } from '@siteflow/shared';

export type { TrialDTO };

export interface BillingStatusResponse {
  billingState: 'trial' | 'trial_grace' | 'trial_expired' | 'active' | 'past_due' | 'canceled' | 'none';
  trial: TrialDTO | null;
  subscription: {
    id: string;
    planId: string;
    planName: string;
    interval: 'month' | 'year';
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  limits: {
    activeProjects: number;
    teamMembers: number;
    storageGb: number;
    aiTokensMonthly: number;
  } | null;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
}

export interface PortalSessionResponse {
  portalUrl: string;
}

export interface SaaSInvoiceDTO {
  id: string;
  invoiceNumber: string | null;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'UNCOLLECTIBLE' | 'VOID';
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  createdAt: string;
}

interface OrgArgs { orgId: string; }

export const billingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Full billing status (trial + subscription in one call) ─────────────
    getBillingStatus: build.query<BillingStatusResponse, OrgArgs>({
      query: ({ orgId }) => `/organizations/${orgId}/billing/status`,
      transformResponse: (raw: { data: BillingStatusResponse }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [
        { type: 'Trial', id: orgId },
        { type: 'Subscription', id: orgId },
      ],
    }),

    // ── Trial (kept for components that only need trial) ───────────────────
    getTrial: build.query<TrialDTO, OrgArgs>({
      query: ({ orgId }) => `/organizations/${orgId}/billing/trial`,
      transformResponse: (raw: { data: TrialDTO }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Trial', id: orgId }],
    }),

    provisionTrial: build.mutation<TrialDTO, OrgArgs>({
      query: ({ orgId }) => ({
        url: `/organizations/${orgId}/billing/trial`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: TrialDTO }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [
        { type: 'Trial', id: orgId },
        { type: 'Subscription', id: orgId },
      ],
    }),

    // ── Stripe Checkout ────────────────────────────────────────────────────
    createCheckoutSession: build.mutation<
      CheckoutSessionResponse,
      OrgArgs & { planId: 'starter' | 'professional' | 'enterprise'; interval: 'month' | 'year' }
    >({
      query: ({ orgId, planId, interval }) => ({
        url: `/organizations/${orgId}/billing/checkout`,
        method: 'POST',
        body: { planId, interval },
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: CheckoutSessionResponse }) => raw.data,
    }),

    // ── Customer Portal ────────────────────────────────────────────────────
    createPortalSession: build.mutation<PortalSessionResponse, OrgArgs>({
      query: ({ orgId }) => ({
        url: `/organizations/${orgId}/billing/portal`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: PortalSessionResponse }) => raw.data,
    }),

    // ── Invoice History ────────────────────────────────────────────────────
    listInvoices: build.query<{ invoices: SaaSInvoiceDTO[] }, OrgArgs>({
      query: ({ orgId }) => `/organizations/${orgId}/billing/invoices`,
      transformResponse: (raw: { data: { invoices: SaaSInvoiceDTO[] } }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Invoice', id: orgId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useGetBillingStatusQuery,
  useGetTrialQuery,
  useProvisionTrialMutation,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
  useListInvoicesQuery,
} = billingApi;
