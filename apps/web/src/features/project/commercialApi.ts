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
  UpdateChangeOrderInput,
  CreateSOVInput,
  UpdateSOVInput,
  CreatePaymentApplicationInput,
  UpdatePaymentApplicationInput,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  CreatePaymentInput,
  CreateCostTransactionInput,
  TransitionInput,
  RejectInput,
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

    updateChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; input: UpdateChangeOrderInput }>({
      query: ({ orgId, projectId, changeOrderId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
      ],
    }),

    submitChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, changeOrderId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}/submit`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
      ],
    }),

    approveChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, changeOrderId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}/approve`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
      ],
    }),

    clientApproveChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, changeOrderId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}/client-approve`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
      ],
    }),

    rejectChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; input: RejectInput }>({
      query: ({ orgId, projectId, changeOrderId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}/reject`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
      ],
    }),

    effectChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, changeOrderId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}/effect`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
        { type: 'Budget', id: projectId }, // Affects budget
      ],
    }),

    voidChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, changeOrderId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}/void`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: ChangeOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
      ],
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

    getSOV: build.query<SOVDTO, OrgProjectArgs & { sovId: string }>({
      query: ({ orgId, projectId, sovId }) =>
        `/organizations/${orgId}/projects/${projectId}/sov/${sovId}`,
      transformResponse: (raw: { data: SOVDTO }) => raw.data,
      providesTags: (_r, _e, { sovId }) => [{ type: 'SOV', id: sovId }],
    }),

    updateSOV: build.mutation<SOVDTO, OrgProjectArgs & { sovId: string; input: UpdateSOVInput }>({
      query: ({ orgId, projectId, sovId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/sov/${sovId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: SOVDTO }) => raw.data,
      invalidatesTags: (_r, _e, { sovId, projectId }) => [
        { type: 'SOV', id: sovId },
        { type: 'SOV', id: projectId },
      ],
    }),

    submitSOV: build.mutation<SOVDTO, OrgProjectArgs & { sovId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, sovId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/sov/${sovId}/submit`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: SOVDTO }) => raw.data,
      invalidatesTags: (_r, _e, { sovId, projectId }) => [
        { type: 'SOV', id: sovId },
        { type: 'SOV', id: projectId },
      ],
    }),

    approveSOV: build.mutation<SOVDTO, OrgProjectArgs & { sovId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, sovId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/sov/${sovId}/approve`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: SOVDTO }) => raw.data,
      invalidatesTags: (_r, _e, { sovId, projectId }) => [
        { type: 'SOV', id: sovId },
        { type: 'SOV', id: projectId },
      ],
    }),

    getSOVProgress: build.query<any, OrgProjectArgs & { sovId: string }>({
      query: ({ orgId, projectId, sovId }) =>
        `/organizations/${orgId}/projects/${projectId}/sov/${sovId}/progress`,
      transformResponse: (raw: { data: any }) => raw.data,
      providesTags: (_r, _e, { sovId }) => [{ type: 'SOV', id: `${sovId}-progress` }],
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

    getPaymentApplication: build.query<PaymentApplicationDTO, OrgProjectArgs & { paId: string }>({
      query: ({ orgId, projectId, paId }) =>
        `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}`,
      transformResponse: (raw: { data: PaymentApplicationDTO }) => raw.data,
      providesTags: (_r, _e, { paId }) => [{ type: 'PaymentApplication', id: paId }],
    }),

    updatePaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { paId: string; input: UpdatePaymentApplicationInput }>({
      query: ({ orgId, projectId, paId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentApplicationDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    submitPaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { paId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, paId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}/submit`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentApplicationDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    underReviewPaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { paId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, paId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}/under-review`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentApplicationDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    approvePaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { paId: string; input: any }>({
      query: ({ orgId, projectId, paId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}/approve`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentApplicationDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    rejectPaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { paId: string; input: RejectInput }>({
      query: ({ orgId, projectId, paId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}/reject`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentApplicationDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    voidPaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { paId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, paId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}/void`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentApplicationDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
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

    getInvoice: build.query<InvoiceDTO, OrgProjectArgs & { invoiceId: string }>({
      query: ({ orgId, projectId, invoiceId }) =>
        `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}`,
      transformResponse: (raw: { data: InvoiceDTO }) => raw.data,
      providesTags: (_r, _e, { invoiceId }) => [{ type: 'Invoice', id: invoiceId }],
    }),

    updateInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { invoiceId: string; input: UpdateInvoiceInput }>({
      query: ({ orgId, projectId, invoiceId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: InvoiceDTO }) => raw.data,
      invalidatesTags: (_r, _e, { invoiceId, projectId }) => [
        { type: 'Invoice', id: invoiceId },
        { type: 'Invoice', id: projectId },
      ],
    }),

    submitInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { invoiceId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, invoiceId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}/submit`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: InvoiceDTO }) => raw.data,
      invalidatesTags: (_r, _e, { invoiceId, projectId }) => [
        { type: 'Invoice', id: invoiceId },
        { type: 'Invoice', id: projectId },
      ],
    }),

    approveInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { invoiceId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, invoiceId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}/approve`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: InvoiceDTO }) => raw.data,
      invalidatesTags: (_r, _e, { invoiceId, projectId }) => [
        { type: 'Invoice', id: invoiceId },
        { type: 'Invoice', id: projectId },
      ],
    }),

    rejectInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { invoiceId: string; input: RejectInput }>({
      query: ({ orgId, projectId, invoiceId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}/reject`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: InvoiceDTO }) => raw.data,
      invalidatesTags: (_r, _e, { invoiceId, projectId }) => [
        { type: 'Invoice', id: invoiceId },
        { type: 'Invoice', id: projectId },
      ],
    }),

    voidInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { invoiceId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, invoiceId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}/void`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: InvoiceDTO }) => raw.data,
      invalidatesTags: (_r, _e, { invoiceId, projectId }) => [
        { type: 'Invoice', id: invoiceId },
        { type: 'Invoice', id: projectId },
      ],
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

    getPayment: build.query<PaymentDTO, OrgProjectArgs & { paymentId: string }>({
      query: ({ orgId, projectId, paymentId }) =>
        `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}`,
      transformResponse: (raw: { data: PaymentDTO }) => raw.data,
      providesTags: (_r, _e, { paymentId }) => [{ type: 'Payment', id: paymentId }],
    }),

    submitPayment: build.mutation<PaymentDTO, OrgProjectArgs & { paymentId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, paymentId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}/submit`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paymentId, projectId }) => [
        { type: 'Payment', id: paymentId },
        { type: 'Payment', id: projectId },
      ],
    }),

    approvePayment: build.mutation<PaymentDTO, OrgProjectArgs & { paymentId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, paymentId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}/approve`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paymentId, projectId }) => [
        { type: 'Payment', id: paymentId },
        { type: 'Payment', id: projectId },
      ],
    }),

    rejectPayment: build.mutation<PaymentDTO, OrgProjectArgs & { paymentId: string; input: RejectInput }>({
      query: ({ orgId, projectId, paymentId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}/reject`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paymentId, projectId }) => [
        { type: 'Payment', id: paymentId },
        { type: 'Payment', id: projectId },
      ],
    }),

    executePayment: build.mutation<PaymentDTO, OrgProjectArgs & { paymentId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, paymentId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}/execute`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: PaymentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paymentId, projectId }) => [
        { type: 'Payment', id: paymentId },
        { type: 'Payment', id: projectId },
      ],
    }),

    voidPayment: build.mutation<PaymentDTO, OrgProjectArgs & { paymentId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, paymentId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}/void`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PaymentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { paymentId, projectId }) => [
        { type: 'Payment', id: paymentId },
        { type: 'Payment', id: projectId },
      ],
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

    getCostTransaction: build.query<CostTransactionDTO, OrgProjectArgs & { transactionId: string }>({
      query: ({ orgId, projectId, transactionId }) =>
        `/organizations/${orgId}/projects/${projectId}/cost-transactions/${transactionId}`,
      transformResponse: (raw: { data: CostTransactionDTO }) => raw.data,
      providesTags: (_r, _e, { transactionId }) => [{ type: 'CostTransaction', id: transactionId }],
    }),

    postCostTransaction: build.mutation<CostTransactionDTO, OrgProjectArgs & { transactionId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, transactionId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-transactions/${transactionId}/post`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: CostTransactionDTO }) => raw.data,
      invalidatesTags: (_r, _e, { transactionId, projectId }) => [
        { type: 'CostTransaction', id: transactionId },
        { type: 'CostTransaction', id: projectId },
      ],
    }),

    voidCostTransaction: build.mutation<CostTransactionDTO, OrgProjectArgs & { transactionId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, transactionId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-transactions/${transactionId}/void`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: CostTransactionDTO }) => raw.data,
      invalidatesTags: (_r, _e, { transactionId, projectId }) => [
        { type: 'CostTransaction', id: transactionId },
        { type: 'CostTransaction', id: projectId },
      ],
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
  // Change Orders
  useListChangeOrdersQuery,
  useGetChangeOrderQuery,
  useCreateChangeOrderMutation,
  useUpdateChangeOrderMutation,
  useSubmitChangeOrderMutation,
  useApproveChangeOrderMutation,
  useClientApproveChangeOrderMutation,
  useRejectChangeOrderMutation,
  useEffectChangeOrderMutation,
  useVoidChangeOrderMutation,
  // Schedule of Values
  useListSOVsQuery,
  useGetSOVQuery,
  useCreateSOVMutation,
  useUpdateSOVMutation,
  useSubmitSOVMutation,
  useApproveSOVMutation,
  useGetSOVProgressQuery,
  // Payment Applications
  useListPaymentApplicationsQuery,
  useGetPaymentApplicationQuery,
  useCreatePaymentApplicationMutation,
  useUpdatePaymentApplicationMutation,
  useSubmitPaymentApplicationMutation,
  useUnderReviewPaymentApplicationMutation,
  useApprovePaymentApplicationMutation,
  useRejectPaymentApplicationMutation,
  useVoidPaymentApplicationMutation,
  // Invoices
  useListInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useSubmitInvoiceMutation,
  useApproveInvoiceMutation,
  useRejectInvoiceMutation,
  useVoidInvoiceMutation,
  // Payments
  useListPaymentsQuery,
  useGetPaymentQuery,
  useCreatePaymentMutation,
  useSubmitPaymentMutation,
  useApprovePaymentMutation,
  useRejectPaymentMutation,
  useExecutePaymentMutation,
  useVoidPaymentMutation,
  // Retainage
  useListRetainageQuery,
  // Cost Transactions
  useListCostTransactionsQuery,
  useGetCostTransactionQuery,
  useCreateCostTransactionMutation,
  usePostCostTransactionMutation,
  useVoidCostTransactionMutation,
  // Summaries
  useGetCommercialSummaryQuery,
  useGetFinancialSummaryQuery,
} = commercialApi;
