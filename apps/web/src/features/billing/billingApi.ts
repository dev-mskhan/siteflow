/**
 * billingApi — Live integration for SaaS billing and subscription management.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Modules: Trial provisioning, Stripe Checkout, Customer Portal, Invoice history
 */
import { baseApi } from '../../services/baseApi';

export interface TrialDTO {
  id: string;
  organizationId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED';
  planTier: string;
  startedAt: string;
  expiresAt: string;
  daysRemaining: number;
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

interface OrgArgs {
  orgId: string;
}

export const billingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Trial Management ───────────────────────────────────────────────────

    getTrial: build.query<TrialDTO, OrgArgs>({
      query: ({ orgId }) => `/organizations/${orgId}/billing/trial`,
      transformResponse: (raw: { data: TrialDTO }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Trial', id: orgId }],
    }),

    provisionTrial: build.mutation<TrialDTO, OrgArgs & { planTier?: string }>({
      query: ({ orgId, planTier }) => ({
        url: `/organizations/${orgId}/billing/trial`,
        method: 'POST',
        body: { planTier },
      }),
      transformResponse: (raw: { data: TrialDTO }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Trial', id: orgId }],
    }),

    // ── Stripe Checkout & Portal ───────────────────────────────────────────

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
      transformResponse: (raw: { data: SaaSInvoiceDTO[] }) => ({ invoices: raw.data }),
      providesTags: (_r, _e, { orgId }) => [{ type: 'Invoice', id: orgId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useGetTrialQuery,
  useProvisionTrialMutation,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
  useListInvoicesQuery,
} = billingApi;
