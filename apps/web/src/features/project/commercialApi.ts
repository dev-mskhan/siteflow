/**
 * commercialApi — Live integration for commercial/financial modules.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Modules: Change Orders, SOV, Payment Applications, Invoices/Payments, 
 *          Retainage, Cost Transactions, Financial Summaries
 */
import { baseApi } from '../../services/baseApi';
import type {
  FinancialAuditEventDTO,
  FinancialAuditPageDTO,
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

interface CommercialList<T> {
  items: T[];
  nextCursor: string | null;
}

interface ListEnvelope<T> {
  data: T[];
  meta?: { nextCursor?: string | null };
}

const toListResult = <T>(raw: ListEnvelope<T>): CommercialList<T> => ({
  items: raw.data,
  nextCursor: raw.meta?.nextCursor ?? null,
});

interface PaymentApplicationApprovalLine {
  scheduleOfValueLineId: string;
  approvedCurrentWork: string;
  approvedStoredMaterials: string;
}

interface TransitionArgs {
  expectedVersion: number;
  reason?: string;
  lines?: PaymentApplicationApprovalLine[];
}

const transitionBody = (action: string, { expectedVersion, reason, lines }: TransitionArgs) => ({
  expectedVersion,
  ...(action === 'reject' ? { reason } : {}),
  ...(lines ? { lines } : {}),
});

type ChangeOrderAction = 'submit' | 'approve' | 'client-approve' | 'reject' | 'effect' | 'void';
type SOVAction = 'submit' | 'approve';
type PaymentApplicationAction = 'submit' | 'under-review' | 'approve' | 'reject' | 'void';
type InvoiceAction = 'submit' | 'approve' | 'reject' | 'void';
type PaymentAction = 'submit' | 'approve' | 'reject' | 'execute' | 'void';

export const commercialApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Change Orders ──────────────────────────────────────────────────────

    listChangeOrders: build.query<CommercialList<ChangeOrderDTO>, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/change-orders`,
      transformResponse: (raw: ListEnvelope<ChangeOrderDTO>) => toListResult(raw),
      providesTags: (_r, _e, { projectId }) => [{ type: 'ChangeOrder', id: projectId }],
    }),

    getChangeOrder: build.query<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string }>({
      query: ({ orgId, projectId, changeOrderId }) =>
        `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}`,
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
      providesTags: (_r, _e, { changeOrderId }) => [{ type: 'ChangeOrder', id: changeOrderId }],
    }),

    createChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { input: CreateChangeOrderInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ChangeOrder', id: projectId }],
    }),

    updateChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; input: UpdateChangeOrderInput }>({
      query: ({ orgId, projectId, changeOrderId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
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
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
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
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
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
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
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
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
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
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
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
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
      ],
    }),

    // ── Schedule of Values ─────────────────────────────────────────────────

    listSOVs: build.query<CommercialList<SOVDTO>, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/sov`,
      transformResponse: (raw: { data: { scheduleOfValues: SOVDTO[]; nextCursor?: string | null } }) => ({
        items: raw.data.scheduleOfValues,
        nextCursor: raw.data.nextCursor ?? null,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'SOV', id: projectId }],
    }),

    createSOV: build.mutation<SOVDTO, OrgProjectArgs & { input: CreateSOVInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/sov`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { scheduleOfValues: SOVDTO } }) => raw.data.scheduleOfValues,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SOV', id: projectId }],
    }),

    getSOV: build.query<SOVDTO, OrgProjectArgs & { sovId: string }>({
      query: ({ orgId, projectId, sovId }) =>
        `/organizations/${orgId}/projects/${projectId}/sov/${sovId}`,
      transformResponse: (raw: { data: { scheduleOfValues: SOVDTO } }) => raw.data.scheduleOfValues,
      providesTags: (_r, _e, { sovId }) => [{ type: 'SOV', id: sovId }],
    }),

    updateSOV: build.mutation<SOVDTO, OrgProjectArgs & { sovId: string; input: UpdateSOVInput }>({
      query: ({ orgId, projectId, sovId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/sov/${sovId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: { scheduleOfValues: SOVDTO } }) => raw.data.scheduleOfValues,
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
      transformResponse: (raw: { data: { scheduleOfValues: SOVDTO } }) => raw.data.scheduleOfValues,
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
      transformResponse: (raw: { data: { scheduleOfValues: SOVDTO } }) => raw.data.scheduleOfValues,
      invalidatesTags: (_r, _e, { sovId, projectId }) => [
        { type: 'SOV', id: sovId },
        { type: 'SOV', id: projectId },
      ],
    }),

    getSOVProgress: build.query<any, OrgProjectArgs & { sovId: string }>({
      query: ({ orgId, projectId, sovId }) =>
        `/organizations/${orgId}/projects/${projectId}/sov/${sovId}/progress`,
      transformResponse: (raw: { data: { progress: any } }) => raw.data.progress,
      providesTags: (_r, _e, { sovId }) => [{ type: 'SOV', id: `${sovId}-progress` }],
    }),

    // ── Payment Applications ───────────────────────────────────────────────

    listPaymentApplications: build.query<CommercialList<PaymentApplicationDTO>, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/payment-applications`,
      transformResponse: (raw: { data: { paymentApplications: PaymentApplicationDTO[]; nextCursor?: string | null } }) => ({
        items: raw.data.paymentApplications,
        nextCursor: raw.data.nextCursor ?? null,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'PaymentApplication', id: projectId }],
    }),

    createPaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { input: CreatePaymentApplicationInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'PaymentApplication', id: projectId }],
    }),

    getPaymentApplication: build.query<PaymentApplicationDTO, OrgProjectArgs & { paId: string }>({
      query: ({ orgId, projectId, paId }) =>
        `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}`,
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
      providesTags: (_r, _e, { paId }) => [{ type: 'PaymentApplication', id: paId }],
    }),

    updatePaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { paId: string; input: UpdatePaymentApplicationInput }>({
      query: ({ orgId, projectId, paId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
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
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
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
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    approvePaymentApplication: build.mutation<
      PaymentApplicationDTO,
      OrgProjectArgs & { paId: string; input: { expectedVersion: number; lines: PaymentApplicationApprovalLine[] } }
    >({
      query: ({ orgId, projectId, paId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}/approve`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
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
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
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
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    // ── Invoices ───────────────────────────────────────────────────────────

    listInvoices: build.query<CommercialList<InvoiceDTO>, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/invoices`,
      transformResponse: (raw: ListEnvelope<InvoiceDTO>) => toListResult(raw),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Invoice', id: projectId }],
    }),

    createInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { input: CreateInvoiceInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { invoice: InvoiceDTO } }) => raw.data.invoice,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Invoice', id: projectId }],
    }),

    getInvoice: build.query<InvoiceDTO, OrgProjectArgs & { invoiceId: string }>({
      query: ({ orgId, projectId, invoiceId }) =>
        `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}`,
      transformResponse: (raw: { data: { invoice: InvoiceDTO } }) => raw.data.invoice,
      providesTags: (_r, _e, { invoiceId }) => [{ type: 'Invoice', id: invoiceId }],
    }),

    updateInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { invoiceId: string; input: UpdateInvoiceInput }>({
      query: ({ orgId, projectId, invoiceId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: { invoice: InvoiceDTO } }) => raw.data.invoice,
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
      transformResponse: (raw: { data: { invoice: InvoiceDTO } }) => raw.data.invoice,
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
      transformResponse: (raw: { data: { invoice: InvoiceDTO } }) => raw.data.invoice,
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
      transformResponse: (raw: { data: { invoice: InvoiceDTO } }) => raw.data.invoice,
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
      transformResponse: (raw: { data: { invoice: InvoiceDTO } }) => raw.data.invoice,
      invalidatesTags: (_r, _e, { invoiceId, projectId }) => [
        { type: 'Invoice', id: invoiceId },
        { type: 'Invoice', id: projectId },
      ],
    }),

    // ── Payments ───────────────────────────────────────────────────────────

    listPayments: build.query<CommercialList<PaymentDTO>, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/payments`,
      transformResponse: (raw: ListEnvelope<PaymentDTO>) => toListResult(raw),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Payment', id: projectId }],
    }),

    createPayment: build.mutation<PaymentDTO, OrgProjectArgs & { input: CreatePaymentInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { payment: PaymentDTO } }) => raw.data.payment,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Payment', id: projectId }],
    }),

    getPayment: build.query<PaymentDTO, OrgProjectArgs & { paymentId: string }>({
      query: ({ orgId, projectId, paymentId }) =>
        `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}`,
      transformResponse: (raw: { data: { payment: PaymentDTO } }) => raw.data.payment,
      providesTags: (_r, _e, { paymentId }) => [{ type: 'Payment', id: paymentId }],
    }),

    submitPayment: build.mutation<PaymentDTO, OrgProjectArgs & { paymentId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, paymentId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}/submit`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { payment: PaymentDTO } }) => raw.data.payment,
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
      transformResponse: (raw: { data: { payment: PaymentDTO } }) => raw.data.payment,
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
      transformResponse: (raw: { data: { payment: PaymentDTO } }) => raw.data.payment,
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
      transformResponse: (raw: { data: { payment: PaymentDTO } }) => raw.data.payment,
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
      transformResponse: (raw: { data: { payment: PaymentDTO } }) => raw.data.payment,
      invalidatesTags: (_r, _e, { paymentId, projectId }) => [
        { type: 'Payment', id: paymentId },
        { type: 'Payment', id: projectId },
      ],
    }),

    // ── Retainage ──────────────────────────────────────────────────────────

    listRetainage: build.query<CommercialList<RetainageDTO>, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/retainage`,
      transformResponse: (raw: ListEnvelope<RetainageDTO>) => toListResult(raw),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Retainage', id: projectId }],
    }),

    listRetainageReleases: build.query<{ items: RetainageReleaseDTO[] }, OrgProjectArgs & { retainageId: string }>({
      query: ({ orgId, projectId, retainageId }) =>
        `/organizations/${orgId}/projects/${projectId}/retainage/${retainageId}/releases`,
      transformResponse: (raw: { data: { releases: RetainageReleaseDTO[] } }) => ({
        items: raw.data.releases,
      }),
      providesTags: (_r, _e, { retainageId }) => [{ type: 'Retainage', id: retainageId }],
    }),

    holdRetainage: build.mutation<RetainageDTO[], OrgProjectArgs & { paymentApplicationId: string }>({
      query: ({ orgId, projectId, paymentApplicationId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paymentApplicationId}/retainage/hold`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { retainageRecords: RetainageDTO[] } }) => raw.data.retainageRecords,
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: 'Retainage', id: projectId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    releaseRetainage: build.mutation<
      { retainageRecord: RetainageDTO; release: RetainageReleaseDTO },
      OrgProjectArgs & { retainageId: string; expectedVersion: number; amount: string; reason: string }
    >({
      query: ({ orgId, projectId, retainageId, expectedVersion, amount, reason }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/retainage/${retainageId}/release`,
        method: 'POST',
        body: { expectedVersion, amount, reason },
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { retainageRecord: RetainageDTO; release: RetainageReleaseDTO } }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, retainageId }) => [
        { type: 'Retainage', id: projectId },
        { type: 'Retainage', id: retainageId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    // ── Cost Transactions ──────────────────────────────────────────────────

    listCostTransactions: build.query<{ transactions: CostTransactionDTO[]; nextCursor: string | null }, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/cost-transactions`,
      transformResponse: (raw: { data: { transactions: CostTransactionDTO[]; nextCursor?: string | null } }) => ({
        transactions: raw.data.transactions,
        nextCursor: raw.data.nextCursor ?? null,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'CostTransaction', id: projectId }],
    }),

    createCostTransaction: build.mutation<CostTransactionDTO, OrgProjectArgs & { input: CreateCostTransactionInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-transactions`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { transaction: CostTransactionDTO } }) => raw.data.transaction,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CostTransaction', id: projectId }],
    }),

    getCostTransaction: build.query<CostTransactionDTO, OrgProjectArgs & { transactionId: string }>({
      query: ({ orgId, projectId, transactionId }) =>
        `/organizations/${orgId}/projects/${projectId}/cost-transactions/${transactionId}`,
      transformResponse: (raw: { data: { transaction: CostTransactionDTO } }) => raw.data.transaction,
      providesTags: (_r, _e, { transactionId }) => [{ type: 'CostTransaction', id: transactionId }],
    }),

    postCostTransaction: build.mutation<CostTransactionDTO, OrgProjectArgs & { transactionId: string; input: TransitionInput }>({
      query: ({ orgId, projectId, transactionId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-transactions/${transactionId}/post`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { transaction: CostTransactionDTO } }) => raw.data.transaction,
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
      transformResponse: (raw: { data: { transaction: CostTransactionDTO } }) => raw.data.transaction,
      invalidatesTags: (_r, _e, { transactionId, projectId }) => [
        { type: 'CostTransaction', id: transactionId },
        { type: 'CostTransaction', id: projectId },
      ],
    }),

    transitionChangeOrder: build.mutation<ChangeOrderDTO, OrgProjectArgs & { changeOrderId: string; action: ChangeOrderAction } & TransitionArgs>({
      query: ({ orgId, projectId, changeOrderId, action, ...args }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}/${action}`,
        method: 'POST',
        body: transitionBody(action, args),
      }),
      transformResponse: (raw: { data: { changeOrder: ChangeOrderDTO } }) => raw.data.changeOrder,
      invalidatesTags: (_r, _e, { changeOrderId, projectId }) => [
        { type: 'ChangeOrder', id: changeOrderId },
        { type: 'ChangeOrder', id: projectId },
        { type: 'Budget', id: projectId },
      ],
    }),

    transitionSOV: build.mutation<SOVDTO, OrgProjectArgs & { sovId: string; action: SOVAction } & TransitionArgs>({
      query: ({ orgId, projectId, sovId, action, ...args }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/sov/${sovId}/${action}`,
        method: 'POST',
        body: transitionBody(action, args),
      }),
      transformResponse: (raw: { data: { scheduleOfValues: SOVDTO } }) => raw.data.scheduleOfValues,
      invalidatesTags: (_r, _e, { sovId, projectId }) => [
        { type: 'SOV', id: sovId },
        { type: 'SOV', id: projectId },
      ],
    }),

    transitionPaymentApplication: build.mutation<PaymentApplicationDTO, OrgProjectArgs & { paId: string; action: PaymentApplicationAction } & TransitionArgs>({
      query: ({ orgId, projectId, paId, action, ...args }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payment-applications/${paId}/${action}`,
        method: 'POST',
        body: transitionBody(action, args),
      }),
      transformResponse: (raw: { data: { paymentApplication: PaymentApplicationDTO } }) => raw.data.paymentApplication,
      invalidatesTags: (_r, _e, { paId, projectId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    transitionInvoice: build.mutation<InvoiceDTO, OrgProjectArgs & { invoiceId: string; action: InvoiceAction } & TransitionArgs>({
      query: ({ orgId, projectId, invoiceId, action, ...args }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}/${action}`,
        method: 'POST',
        body: transitionBody(action, args),
      }),
      transformResponse: (raw: { data: { invoice: InvoiceDTO } }) => raw.data.invoice,
      invalidatesTags: (_r, _e, { invoiceId, projectId }) => [
        { type: 'Invoice', id: invoiceId },
        { type: 'Invoice', id: projectId },
      ],
    }),

    transitionPayment: build.mutation<PaymentDTO, OrgProjectArgs & { paymentId: string; action: PaymentAction } & TransitionArgs>({
      query: ({ orgId, projectId, paymentId, action, ...args }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/payments/${paymentId}/${action}`,
        method: 'POST',
        body: transitionBody(action, args),
        headers: action === 'execute' ? { 'idempotency-key': crypto.randomUUID() } : undefined,
      }),
      transformResponse: (raw: { data: { payment: PaymentDTO } }) => raw.data.payment,
      invalidatesTags: (_r, _e, { paymentId, projectId }) => [
        { type: 'Payment', id: paymentId },
        { type: 'Payment', id: projectId },
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

    getFinancialAudit: build.query<
      FinancialAuditPageDTO,
      OrgProjectArgs & { limit?: number; cursor?: string; action?: string; entityType?: string }
    >({
      query: ({ orgId, projectId, ...params }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/financial-audit`,
        params,
      }),
      transformResponse: (raw: {
        data: FinancialAuditEventDTO[];
        meta?: { nextCursor?: string | null };
      }) => ({ events: raw.data, nextCursor: raw.meta?.nextCursor ?? null }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'FinancialSummary', id: projectId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useGetFinancialAuditQuery,
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
  useLazyGetPaymentApplicationQuery,
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
  useListRetainageReleasesQuery,
  useHoldRetainageMutation,
  useReleaseRetainageMutation,
  // Cost Transactions
  useListCostTransactionsQuery,
  useGetCostTransactionQuery,
  useCreateCostTransactionMutation,
  usePostCostTransactionMutation,
  useVoidCostTransactionMutation,
  // Generic transitions
  useTransitionChangeOrderMutation,
  useTransitionSOVMutation,
  useTransitionPaymentApplicationMutation,
  useTransitionInvoiceMutation,
  useTransitionPaymentMutation,
  // Summaries
  useGetCommercialSummaryQuery,
  useGetFinancialSummaryQuery,
} = commercialApi;
