/**
 * commercialApi — Live integration for commercial/financial modules.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Modules: Change Orders, SOV, Payment Applications, Invoices/Payments, 
 *          Retainage, Cost Transactions, Financial Summaries
 */
import { baseApi } from '../../services/baseApi';
import type {
  ChangeOrderDTO,
  SOVDTO,
  PaymentApplicationDTO,
  InvoiceDTO,
  PaymentDTO,
  RetainageDTO,
  CostTransactionDTO,
  CommercialSummaryDTO,
  FinancialSummaryDTO,
  CreateChangeOrderInput,
  CreateSOVInput,
  CreatePaymentApplicationInput,
  CreateInvoiceInput,
  CreatePaymentInput,
  CreateCostTransactionInput,
} from '../../types/commercialTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const commercialApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Change Orders ──────────────────────────────────────────────────────

    listChangeOrders: build.query<ChangeOrderDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/change-orders`,
      transformResponse: (raw: { data: ChangeOrderDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'ChangeOrder', id: projectId }],
    }),

    getChangeOrder: build.query<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string }>({
      query: ({ orgId, projectId, changeOrderId }) =>
        `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}`,
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      providesTags: (_r, _e, { changeOrderId }) => [{ type: 'ChangeOrder', id: changeOrderId }],
    }),

    createChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { input: CreateChangeOrderInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ChangeOrder', id: projectId }],
    }),

    // ── Schedule of Values ─────────────────────────────────────────────────

    listSOVs: build.query<SOVDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/sov`,
      transformResponse: (raw: { data: SOVDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'SOV', id: projectId }],
    }),

    createSOV: build.mutation<SOVDTO, OrgProjectArgs & { input: CreateSOVInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/sov`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: SOVDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SOV', id: projectId }],
    }),

    // ── Payment Applications ───────────────────────────────────────────────

    listPaymentApplications: build.query<PaymentApplicationDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/payment-applications`,
      transformResponse: (raw: { data: PaymentApplicationDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'PaymentApplication', id: projectId }],
    }),

    createPaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { input: CreatePaymentApplicationInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentApplicationDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'PaymentApplication', id: projectId }],
    }),

    // ── Invoices ───────────────────────────────────────────────────────────

    listInvoices: build.query<InvoiceDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/invoices`,
      transformResponse: (raw: { data: InvoiceDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Invoice', id: projectId }],
    }),

    createInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { input: CreateInvoiceInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: InvoiceDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Invoice', id: projectId }],
    }),

    // ── Payments ───────────────────────────────────────────────────────────

    listPayments: build.query<PaymentDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/payments`,
      transformResponse: (raw: { data: PaymentDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Payment', id: projectId }],
    }),

    createPayment: build.mutation<PaymentDTO, OrgProjectArgs & { input: CreatePaymentInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: PaymentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Payment', id: projectId }],
    }),

    // ── Retainage ──────────────────────────────────────────────────────────

    listRetainage: build.query<RetainageDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/retainage`,
      transformResponse: (raw: { data: RetainageDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Retainage', id: projectId }],
    }),

    // ── Cost Transactions ──────────────────────────────────────────────────

    listCostTransactions: build.query<CostTransactionDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/cost-transactions`,
      transformResponse: (raw: { data: CostTransactionDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'CostTransaction', id: projectId }],
    }),

    createCostTransaction: build.mutation<CostTransactionDTO, OrgProjectArgs & { input: CreateCostTransactionInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-transactions`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: CostTransactionDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CostTransaction', id: projectId }],
    }),

    // ── Financial Summaries ────────────────────────────────────────────────

    getCommercialSummary: build.query<CommercialSummaryDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/commercial-summary`,
      transformResponse: (raw: { data: CommercialSummaryDTO }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'CommercialSummary', id: projectId }],
    }),

    getFinancialSummary: build.query<FinancialSummaryDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/financial-summary`,
      transformResponse: (raw: { data: FinancialSummaryDTO }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'FinancialSummary', id: projectId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListChangeOrdersQuery,
  useGetChangeOrderQuery,
  useCreateChangeOrderMutation,
  useListSOVsQuery,
  useCreateSOVMutation,
  useListPaymentApplicationsQuery,
  useCreatePaymentApplicationMutation,
  useListInvoicesQuery,
  useCreateInvoiceMutation,
  useListPaymentsQuery,
  useCreatePaymentMutation,
  useListRetainageQuery,
  useListCostTransactionsQuery,
  useCreateCostTransactionMutation,
  useGetCommercialSummaryQuery,
  useGetFinancialSummaryQuery,
} = commercialApi;
