/**
 * billingApi — SaaS billing: trial, checkout, portal, invoices.
 * Backend:
 *   POST /:orgId/billing/trial         — provision 14-day trial (billing:manage)
 *   GET  /:orgId/billing/trial         — get trial status (billing:read)
 *   POST /:orgId/billing/checkout      — create Stripe Checkout session (billing:manage, idempotency-key)
 *   POST /:orgId/billing/portal        — create Stripe Customer Portal session (billing:manage)
 *   GET  /:orgId/billing/invoices      — list SaaS invoice + payment history (billing:read)
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

export interface TrialDTO {
  id: string;
  organizationId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED';
  planTier: string;
  startedAt: string;
  expiresAt: string;
  daysRemaining: number;
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

export const billingApi = createApi({
  reducerPath: 'billingApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Trial', 'Invoice'],
  endpoints: (build) => ({

    getTrial: build.query<TrialDTO, { orgId: string }>({
      queryFn: async () => {
        await delay(150);
        const expires = new Date();
        expires.setDate(expires.getDate() + 12);
        return {
          data: {
            id: 'trial_01',
            organizationId: 'org_01',
            status: 'ACTIVE',
            planTier: 'Professional',
            startedAt: '2024-10-08T00:00:00.000Z',
            expiresAt: expires.toISOString(),
            daysRemaining: 12,
          },
        };
      },
      providesTags: ['Trial'],
    }),

    provisionTrial: build.mutation<TrialDTO, { orgId: string }>({
      queryFn: async ({ orgId }) => {
        await delay(200);
        const expires = new Date();
        expires.setDate(expires.getDate() + 14);
        return {
          data: {
            id: 'trial_01',
            organizationId: orgId,
            status: 'ACTIVE',
            planTier: 'Professional',
            startedAt: new Date().toISOString(),
            expiresAt: expires.toISOString(),
            daysRemaining: 14,
          },
        };
      },
      invalidatesTags: ['Trial'],
    }),

    createCheckout: build.mutation<{ checkoutUrl: string }, { orgId: string; planId: 'starter' | 'professional' | 'enterprise'; interval: 'month' | 'year' }>({
      queryFn: async ({ orgId, planId, interval }) => {
        await delay(300);
        return {
          data: { checkoutUrl: `https://checkout.stripe.com/c/mock_${orgId}_${planId}_${interval}` },
        };
      },
    }),

    createPortalSession: build.mutation<{ portalUrl: string }, { orgId: string }>({
      queryFn: async () => {
        await delay(250);
        return { data: { portalUrl: 'https://billing.stripe.com/p/mock_portal_session' } };
      },
    }),

    listInvoices: build.query<{ invoices: SaaSInvoiceDTO[] }, { orgId: string; limit?: number }>({
      queryFn: async () => {
        await delay(150);
        return {
          data: {
            invoices: [
              { id: 'inv_saas_01', invoiceNumber: 'SaaS-2024-001', status: 'PAID', amountDueCents: 0, amountPaidCents: 4900, currency: 'usd', periodStart: '2024-10-01T00:00:00.000Z', periodEnd: '2024-10-31T23:59:59.000Z', hostedInvoiceUrl: 'https://invoice.stripe.com/i/mock_01', invoicePdfUrl: 'https://invoice.stripe.com/pdf/mock_01', createdAt: '2024-10-01T00:00:00.000Z' },
            ],
          },
        };
      },
      providesTags: ['Invoice'],
    }),
  }),
});

export const {
  useGetTrialQuery,
  useProvisionTrialMutation,
  useCreateCheckoutMutation,
  useCreatePortalSessionMutation,
  useListInvoicesQuery,
} = billingApi;
