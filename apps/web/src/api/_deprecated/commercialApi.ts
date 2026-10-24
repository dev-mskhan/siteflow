/**
 * commercialApi — RTK Query slice for Group 8 commercial/financial entities.
 *
 * Backend sources (all authoritative):
 *   Change Order:    apps/server/src/modules/project/change-order/
 *   SOV:             apps/server/src/modules/project/schedule-of-values/
 *   Payment App:     apps/server/src/modules/project/payment-application/
 *   Invoice/Payment: apps/server/src/modules/project/invoice-payment/
 *   Retainage:       apps/server/src/modules/project/retainage/
 *   Cost Txn:        apps/server/src/modules/project/cost-transaction/
 *   Summaries:       apps/server/src/modules/project/commercial-summary/
 *                    apps/server/src/modules/project/financial-summary/
 *
 * Key business rules enforced in queryFn:
 *   - All lifecycle transitions require expectedVersion (optimistic locking)
 *   - reject always requires reason string (min 1 char, confirmed by server)
 *   - effect (change order) requires idempotency-key — generated as UUID on frontend
 *   - execute (payment) requires idempotency-key header
 *   - hold (retainage) requires idempotency-key
 *   - release (retainage) requires idempotency-key + body {expectedVersion, amount, reason}
 *   - create invoice/payment requires idempotency-key
 *   - create cost-transaction requires idempotency-key
 *   - post cost-transaction requires idempotency-key + expectedVersion
 *   - void cost-transaction requires idempotency-key + {expectedVersion, reason}
 *   - effect on change order is IRREVERSIBLE — frontend must confirm before calling
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  ChangeOrderDTO,
  ChangeOrderStatus,
  CreateChangeOrderInput,
  SOVDTO,
  SOVStatus,
  SOVProgressDTO,
  CreateSOVInput,
  PaymentApplicationDTO,
  PaymentApplicationStatus,
  CreatePaymentApplicationInput,
  InvoiceDTO,
  InvoiceStatus,
  CreateInvoiceInput,
  PaymentDTO,
  PaymentStatus,
  CreatePaymentInput,
  RetainageDTO,
  RetainageReleaseDTO,
  CostTransactionDTO,
  CostTransactionStatus,
  CreateCostTransactionInput,
  CommercialSummaryDTO,
  FinancialSummaryDTO,
  CostSummaryDTO,
  CommitmentSummaryDTO,
  BillingSummaryDTO,
  CashSummaryDTO,
  FinancialAuditPageDTO,
} from '../types/commercialTypes';
import {
  MOCK_CHANGE_ORDERS,
  MOCK_SOVS,
  MOCK_PAYMENT_APPLICATIONS,
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MOCK_RETAINAGE,
  MOCK_RETAINAGE_RELEASES,
  MOCK_COST_TRANSACTIONS,
} from '../fixtures/commercial.fixtures';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

// ── State transition guards — mirror server service files ─────────────────────
const CO_TRANSITIONS: Record<string, ChangeOrderStatus[]> = {
  DRAFT:               ['PENDING_APPROVAL'],
  PENDING_APPROVAL:    ['INTERNALLY_APPROVED', 'REJECTED'],
  INTERNALLY_APPROVED: ['CLIENT_APPROVED', 'REJECTED'],
  CLIENT_APPROVED:     ['EFFECTED', 'REJECTED'],
  REJECTED:            ['DRAFT'], // goes back to draft after rejection for edit
};
const CO_VOIDABLE = new Set(['DRAFT', 'PENDING_APPROVAL', 'INTERNALLY_APPROVED', 'CLIENT_APPROVED', 'REJECTED']);

const PA_TRANSITIONS: Record<string, PaymentApplicationStatus[]> = {
  DRAFT:       ['SUBMITTED'],
  SUBMITTED:   ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW:['APPROVED', 'REJECTED'],
};

const INV_TRANSITIONS: Record<string, InvoiceStatus[]> = {
  DRAFT:    ['SUBMITTED'],
  SUBMITTED:['APPROVED', 'REJECTED'],
};

const PMT_TRANSITIONS: Record<string, PaymentStatus[]> = {
  DRAFT:    ['SUBMITTED'],
  SUBMITTED:['APPROVED', 'REJECTED'],
  APPROVED: ['EXECUTED'],
  EXECUTED: ['VOID'],
};

// UUID v4 helper — idempotency keys are opaque strings on the server
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const commercialApi = createApi({
  reducerPath: 'commercialApi',
  baseQuery: mockBaseQuery,
  tagTypes: [
    'ChangeOrder',
    'SOV', 'SOVProgress',
    'PaymentApplication',
    'Invoice',
    'Payment',
    'Retainage', 'RetainageRelease',
    'CostTransaction',
    'CommercialSummary',
    'FinancialSummary',
  ],

  endpoints: (build) => ({

    // ══ CHANGE ORDERS ══════════════════════════════════════════════════════

    listChangeOrders: build.query<{ items: ChangeOrderDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: ChangeOrderStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_CHANGE_ORDERS[projectId] ?? [];
        if (status) items = items.filter((c) => c.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'ChangeOrder', id: projectId }],
    }),

    getChangeOrder: build.query<ChangeOrderDTO, { orgId: string; projectId: string; changeOrderId: string }>({
      queryFn: async ({ projectId, changeOrderId }) => {
        await delay(120);
        const co = (MOCK_CHANGE_ORDERS[projectId] ?? []).find((x) => x.id === changeOrderId);
        if (!co) return { error: { status: 404, error: 'CHANGE_ORDER_NOT_FOUND' } };
        return { data: co };
      },
      providesTags: (_r, _e, { changeOrderId }) => [{ type: 'ChangeOrder', id: changeOrderId }],
    }),

    createChangeOrder: build.mutation<ChangeOrderDTO, { orgId: string; projectId: string; input: CreateChangeOrderInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const num = `CO-${new Date().getFullYear()}-${String((MOCK_CHANGE_ORDERS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const co: ChangeOrderDTO = {
          id: `co_${Date.now()}`,
          organizationId: orgId,
          projectId,
          changeOrderNumber: num,
          title: input.title,
          description: input.description ?? null,
          reason: input.reason ?? null,
          status: 'DRAFT',
          contractAmount: input.contractAmount ?? null,
          revisedContractAmount: null,
          currencyCode: input.currencyCode,
          version: 1,
          createdBy: 'usr_01',
          submittedBy: null, submittedAt: null,
          approvedBy: null, approvedAt: null,
          clientApprovedBy: null, clientApprovedAt: null,
          rejectedBy: null, rejectedAt: null, rejectionReason: null,
          effectedBy: null, effectedAt: null,
          voidedBy: null, voidedAt: null,
          lines: (input.lines ?? []).map((l, i) => ({ id: `col_${Date.now()}_${i}`, ...l, costCodeId: l.costCodeId ?? null })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_CHANGE_ORDERS[projectId] = [...(MOCK_CHANGE_ORDERS[projectId] ?? []), co];
        return { data: co };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ChangeOrder', id: projectId }],
    }),

    updateChangeOrder: build.mutation<ChangeOrderDTO, { orgId: string; projectId: string; changeOrderId: string; input: Partial<CreateChangeOrderInput> & { expectedVersion: number } }>({
      queryFn: async ({ projectId, changeOrderId, input }) => {
        await delay(180);
        const list = MOCK_CHANGE_ORDERS[projectId] ?? [];
        const co = list.find((x) => x.id === changeOrderId);
        if (!co) return { error: { status: 404, error: 'CHANGE_ORDER_NOT_FOUND' } };
        if (co.version !== input.expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };
        if (!['DRAFT', 'REJECTED'].includes(co.status)) return { error: { status: 409, error: 'CHANGE_ORDER_NOT_EDITABLE' } };
        const updated = { ...co, ...input, version: co.version + 1, updatedAt: new Date().toISOString() };
        MOCK_CHANGE_ORDERS[projectId] = list.map((x) => x.id === changeOrderId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, changeOrderId }) => [
        { type: 'ChangeOrder', id: changeOrderId }, { type: 'ChangeOrder', id: projectId },
      ],
    }),

    transitionChangeOrder: build.mutation<ChangeOrderDTO, {
      orgId: string; projectId: string; changeOrderId: string;
      action: 'submit' | 'approve' | 'client-approve' | 'reject' | 'effect' | 'void';
      expectedVersion: number; reason?: string;
    }>({
      queryFn: async ({ projectId, changeOrderId, action, expectedVersion, reason }) => {
        await delay(200);
        const list = MOCK_CHANGE_ORDERS[projectId] ?? [];
        const co = list.find((x) => x.id === changeOrderId);
        if (!co) return { error: { status: 404, error: 'CHANGE_ORDER_NOT_FOUND' } };
        if (co.version !== expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };

        // Guard: void
        if (action === 'void') {
          if (!CO_VOIDABLE.has(co.status)) return { error: { status: 409, error: 'CHANGE_ORDER_ALREADY_EFFECTED' } };
        } else if (action !== 'reject') {
          const actionToStatus: Record<string, ChangeOrderStatus> = {
            submit: 'PENDING_APPROVAL',
            approve: 'INTERNALLY_APPROVED',
            'client-approve': 'CLIENT_APPROVED',
            effect: 'EFFECTED',
          };
          const target = actionToStatus[action];
          if (target && !CO_TRANSITIONS[co.status]?.includes(target)) {
            return { error: { status: 409, error: 'CHANGE_ORDER_INVALID_TRANSITION' } };
          }
        }
        if (action === 'reject' && (!reason || !reason.trim())) {
          return { error: { status: 422, error: 'REASON_REQUIRED' } };
        }

        const now = new Date().toISOString();
        const statusMap: Record<string, ChangeOrderStatus> = {
          submit: 'PENDING_APPROVAL',
          approve: 'INTERNALLY_APPROVED',
          'client-approve': 'CLIENT_APPROVED',
          effect: 'EFFECTED',
          reject: 'REJECTED',
          void: 'VOIDED',
        };
        const updated: ChangeOrderDTO = {
          ...co,
          status: statusMap[action]!,
          version: co.version + 1,
          updatedAt: now,
          submittedBy: action === 'submit' ? 'usr_01' : co.submittedBy,
          submittedAt: action === 'submit' ? now : co.submittedAt,
          approvedBy: action === 'approve' ? 'usr_01' : co.approvedBy,
          approvedAt: action === 'approve' ? now : co.approvedAt,
          clientApprovedBy: action === 'client-approve' ? 'usr_01' : co.clientApprovedBy,
          clientApprovedAt: action === 'client-approve' ? now : co.clientApprovedAt,
          rejectedBy: action === 'reject' ? 'usr_01' : co.rejectedBy,
          rejectedAt: action === 'reject' ? now : co.rejectedAt,
          rejectionReason: action === 'reject' ? (reason ?? null) : co.rejectionReason,
          effectedBy: action === 'effect' ? 'usr_01' : co.effectedBy,
          effectedAt: action === 'effect' ? now : co.effectedAt,
          voidedBy: action === 'void' ? 'usr_01' : co.voidedBy,
          voidedAt: action === 'void' ? now : co.voidedAt,
        };
        MOCK_CHANGE_ORDERS[projectId] = list.map((x) => x.id === changeOrderId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, changeOrderId }) => [
        { type: 'ChangeOrder', id: changeOrderId }, { type: 'ChangeOrder', id: projectId },
        { type: 'CommercialSummary', id: projectId },
      ],
    }),

    // ══ SCHEDULE OF VALUES ═════════════════════════════════════════════════

    listSOVs: build.query<{ items: SOVDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: SOVStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_SOVS[projectId] ?? [];
        if (status) items = items.filter((s) => s.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'SOV', id: projectId }],
    }),

    getSOV: build.query<SOVDTO, { orgId: string; projectId: string; sovId: string }>({
      queryFn: async ({ projectId, sovId }) => {
        await delay(120);
        const s = (MOCK_SOVS[projectId] ?? []).find((x) => x.id === sovId);
        if (!s) return { error: { status: 404, error: 'SOV_NOT_FOUND' } };
        return { data: s };
      },
      providesTags: (_r, _e, { sovId }) => [{ type: 'SOV', id: sovId }],
    }),

    getSOVProgress: build.query<SOVProgressDTO, { orgId: string; projectId: string; sovId: string }>({
      queryFn: async ({ projectId, sovId }) => {
        await delay(120);
        const s = (MOCK_SOVS[projectId] ?? []).find((x) => x.id === sovId);
        if (!s) return { error: { status: 404, error: 'SOV_NOT_FOUND' } };
        const totalEarned = s.lines.reduce((acc, l) => acc + parseFloat(l.totalEarned), 0);
        const totalRetainage = s.lines.reduce((acc, l) => acc + parseFloat(l.retainageAmount), 0);
        const pct = s.totalScheduledValue !== '0.00'
          ? ((totalEarned / parseFloat(s.totalScheduledValue)) * 100).toFixed(2)
          : '0.00';
        return {
          data: {
            sovId,
            totalScheduledValue: s.totalScheduledValue,
            totalEarnedToDate: totalEarned.toFixed(2),
            totalRetainage: totalRetainage.toFixed(2),
            percentComplete: pct,
            lines: s.lines.map((l) => ({
              lineId: l.id,
              description: l.description,
              scheduledValue: l.scheduledValue,
              percentComplete: l.percentComplete,
              totalEarned: l.totalEarned,
            })),
          },
        };
      },
      providesTags: (_r, _e, { sovId }) => [{ type: 'SOVProgress', id: sovId }],
    }),

    createSOV: build.mutation<SOVDTO, { orgId: string; projectId: string; input: CreateSOVInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const num = `SOV-${new Date().getFullYear()}-${String((MOCK_SOVS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const sov: SOVDTO = {
          id: `sov_${Date.now()}`,
          organizationId: orgId,
          projectId,
          sovNumber: num,
          title: input.title,
          description: input.description ?? null,
          status: 'DRAFT',
          currencyCode: input.currencyCode,
          totalScheduledValue: (input.lines ?? []).reduce((acc, l) => acc + parseFloat(l.scheduledValue || '0'), 0).toFixed(2),
          version: 1,
          createdBy: 'usr_01',
          approvedBy: null,
          approvedAt: null,
          lines: (input.lines ?? []).map((l, i) => ({
            id: `sovl_${Date.now()}_${i}`,
            sovId: `sov_${Date.now()}`,
            lineNumber: i + 1,
            description: l.description,
            costCodeId: l.costCodeId ?? null,
            scheduledValue: l.scheduledValue,
            currencyCode: l.currencyCode,
            percentComplete: '0',
            workCompletedThisPeriod: '0.00',
            workCompletedPreviousPeriods: '0.00',
            workCompletedToDate: '0.00',
            storedMaterials: '0.00',
            totalEarned: '0.00',
            balanceToFinish: l.scheduledValue,
            retainagePercent: l.retainagePercent ?? '10',
            retainageAmount: '0.00',
          })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_SOVS[projectId] = [...(MOCK_SOVS[projectId] ?? []), sov];
        return { data: sov };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SOV', id: projectId }],
    }),

    transitionSOV: build.mutation<SOVDTO, { orgId: string; projectId: string; sovId: string; action: 'submit' | 'approve'; expectedVersion: number }>({
      queryFn: async ({ projectId, sovId, action, expectedVersion }) => {
        await delay(180);
        const list = MOCK_SOVS[projectId] ?? [];
        const sov = list.find((x) => x.id === sovId);
        if (!sov) return { error: { status: 404, error: 'SOV_NOT_FOUND' } };
        if (sov.version !== expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };
        const allowed: Record<string, SOVStatus> = { submit: 'DRAFT', approve: 'SUBMITTED' };
        if (sov.status !== allowed[action]) return { error: { status: 409, error: 'SOV_INVALID_TRANSITION' } };
        const statusMap: Record<string, SOVStatus> = { submit: 'SUBMITTED', approve: 'APPROVED' };
        const now = new Date().toISOString();
        const updated: SOVDTO = {
          ...sov,
          status: statusMap[action]!,
          version: sov.version + 1,
          updatedAt: now,
          approvedBy: action === 'approve' ? 'usr_01' : sov.approvedBy,
          approvedAt: action === 'approve' ? now : sov.approvedAt,
        };
        MOCK_SOVS[projectId] = list.map((x) => x.id === sovId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, sovId }) => [
        { type: 'SOV', id: sovId }, { type: 'SOV', id: projectId },
      ],
    }),

    // ══ PAYMENT APPLICATIONS ═══════════════════════════════════════════════

    listPaymentApplications: build.query<{ items: PaymentApplicationDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: PaymentApplicationStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_PAYMENT_APPLICATIONS[projectId] ?? [];
        if (status) items = items.filter((p) => p.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'PaymentApplication', id: projectId }],
    }),

    getPaymentApplication: build.query<PaymentApplicationDTO, { orgId: string; projectId: string; paId: string }>({
      queryFn: async ({ projectId, paId }) => {
        await delay(120);
        const pa = (MOCK_PAYMENT_APPLICATIONS[projectId] ?? []).find((x) => x.id === paId);
        if (!pa) return { error: { status: 404, error: 'PA_NOT_FOUND' } };
        return { data: pa };
      },
      providesTags: (_r, _e, { paId }) => [{ type: 'PaymentApplication', id: paId }],
    }),

    createPaymentApplication: build.mutation<PaymentApplicationDTO, { orgId: string; projectId: string; input: CreatePaymentApplicationInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const num = `PA-${new Date().getFullYear()}-${String((MOCK_PAYMENT_APPLICATIONS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const pa: PaymentApplicationDTO = {
          id: `pa_${Date.now()}`,
          organizationId: orgId,
          projectId,
          applicationNumber: num,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: 'DRAFT',
          scheduledValue: '0.00',
          workCompletedThisPeriod: input.workCompletedThisPeriod ?? '0.00',
          workCompletedPreviousPeriods: '0.00',
          workCompletedToDate: input.workCompletedThisPeriod ?? '0.00',
          storedMaterials: input.storedMaterials ?? '0.00',
          totalEarned: input.workCompletedThisPeriod ?? '0.00',
          retainageAmount: '0.00',
          previousRetainage: '0.00',
          totalRetainageHeld: '0.00',
          netAmountDue: input.workCompletedThisPeriod ?? '0.00',
          approvedAmount: null,
          currencyCode: input.currencyCode,
          version: 1,
          createdBy: 'usr_01',
          submittedBy: null, submittedAt: null,
          reviewedBy: null, reviewedAt: null,
          approvedBy: null, approvedAt: null,
          rejectedBy: null, rejectedAt: null, rejectionReason: null,
          voidedBy: null, voidedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_PAYMENT_APPLICATIONS[projectId] = [...(MOCK_PAYMENT_APPLICATIONS[projectId] ?? []), pa];
        return { data: pa };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'PaymentApplication', id: projectId }],
    }),

    transitionPaymentApplication: build.mutation<PaymentApplicationDTO, {
      orgId: string; projectId: string; paId: string;
      action: 'submit' | 'under-review' | 'approve' | 'reject' | 'void';
      expectedVersion: number; reason?: string; approvedAmount?: string;
    }>({
      queryFn: async ({ projectId, paId, action, expectedVersion, reason, approvedAmount }) => {
        await delay(180);
        const list = MOCK_PAYMENT_APPLICATIONS[projectId] ?? [];
        const pa = list.find((x) => x.id === paId);
        if (!pa) return { error: { status: 404, error: 'PA_NOT_FOUND' } };
        if (pa.version !== expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };
        if (action === 'reject' && (!reason || !reason.trim())) return { error: { status: 422, error: 'REASON_REQUIRED' } };
        if (action === 'void' && !['DRAFT', 'REJECTED'].includes(pa.status)) return { error: { status: 409, error: 'PA_NOT_VOIDABLE' } };

        const statusMap: Record<string, PaymentApplicationStatus> = {
          submit: 'SUBMITTED',
          'under-review': 'UNDER_REVIEW',
          approve: 'APPROVED',
          reject: 'REJECTED',
          void: 'VOID',
        };
        if (action !== 'void' && action !== 'reject') {
          const target = statusMap[action]!;
          if (!PA_TRANSITIONS[pa.status]?.includes(target)) {
            return { error: { status: 409, error: 'PA_INVALID_TRANSITION' } };
          }
        }
        const now = new Date().toISOString();
        const updated: PaymentApplicationDTO = {
          ...pa,
          status: statusMap[action]!,
          version: pa.version + 1,
          updatedAt: now,
          submittedBy: action === 'submit' ? 'usr_01' : pa.submittedBy,
          submittedAt: action === 'submit' ? now : pa.submittedAt,
          reviewedBy: action === 'under-review' ? 'usr_01' : pa.reviewedBy,
          reviewedAt: action === 'under-review' ? now : pa.reviewedAt,
          approvedBy: action === 'approve' ? 'usr_01' : pa.approvedBy,
          approvedAt: action === 'approve' ? now : pa.approvedAt,
          approvedAmount: action === 'approve' ? (approvedAmount ?? pa.netAmountDue) : pa.approvedAmount,
          rejectedBy: action === 'reject' ? 'usr_01' : pa.rejectedBy,
          rejectedAt: action === 'reject' ? now : pa.rejectedAt,
          rejectionReason: action === 'reject' ? (reason ?? null) : pa.rejectionReason,
          voidedBy: action === 'void' ? 'usr_01' : pa.voidedBy,
          voidedAt: action === 'void' ? now : pa.voidedAt,
        };
        MOCK_PAYMENT_APPLICATIONS[projectId] = list.map((x) => x.id === paId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, paId }) => [
        { type: 'PaymentApplication', id: paId },
        { type: 'PaymentApplication', id: projectId },
      ],
    }),

    // ══ INVOICES ═══════════════════════════════════════════════════════════

    listInvoices: build.query<{ items: InvoiceDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: InvoiceStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_INVOICES[projectId] ?? [];
        if (status) items = items.filter((i) => i.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Invoice', id: projectId }],
    }),

    getInvoice: build.query<InvoiceDTO, { orgId: string; projectId: string; invoiceId: string }>({
      queryFn: async ({ projectId, invoiceId }) => {
        await delay(120);
        const inv = (MOCK_INVOICES[projectId] ?? []).find((x) => x.id === invoiceId);
        if (!inv) return { error: { status: 404, error: 'INVOICE_NOT_FOUND' } };
        return { data: inv };
      },
      providesTags: (_r, _e, { invoiceId }) => [{ type: 'Invoice', id: invoiceId }],
    }),

    createInvoice: build.mutation<InvoiceDTO, { orgId: string; projectId: string; input: CreateInvoiceInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(220);
        const now = new Date().toISOString();
        const num = `INV-${new Date().getFullYear()}-${String((MOCK_INVOICES[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const subtotal = input.lines.reduce((acc, l) => acc + parseFloat(l.amount || '0'), 0);
        const taxAmount = input.lines.reduce((acc, l) => acc + (parseFloat(l.amount || '0') * parseFloat(l.taxPercent || '0') / 100), 0);
        const inv: InvoiceDTO = {
          id: `inv_${Date.now()}`,
          organizationId: orgId,
          projectId,
          invoiceNumber: num,
          invoiceType: input.invoiceType,
          status: 'DRAFT',
          issueDate: input.issueDate,
          dueDate: input.dueDate ?? null,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: (subtotal + taxAmount).toFixed(2),
          paidAmount: '0.00',
          outstandingAmount: (subtotal + taxAmount).toFixed(2),
          currencyCode: input.currencyCode,
          paymentApplicationId: input.paymentApplicationId ?? null,
          description: input.description ?? null,
          notes: input.notes ?? null,
          version: 1,
          createdBy: 'usr_01',
          submittedBy: null, submittedAt: null,
          approvedBy: null, approvedAt: null,
          rejectedBy: null, rejectedAt: null, rejectionReason: null,
          voidedBy: null, voidedAt: null,
          lines: input.lines.map((l, i) => ({
            id: `invl_${Date.now()}_${i}`,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unitRate: l.unitRate,
            amount: l.amount,
            taxPercent: l.taxPercent ?? '0',
            taxAmount: (parseFloat(l.amount) * parseFloat(l.taxPercent ?? '0') / 100).toFixed(2),
            totalAmount: (parseFloat(l.amount) * (1 + parseFloat(l.taxPercent ?? '0') / 100)).toFixed(2),
            costCodeId: l.costCodeId ?? null,
          })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_INVOICES[projectId] = [...(MOCK_INVOICES[projectId] ?? []), inv];
        return { data: inv };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Invoice', id: projectId }],
    }),

    transitionInvoice: build.mutation<InvoiceDTO, {
      orgId: string; projectId: string; invoiceId: string;
      action: 'submit' | 'approve' | 'reject' | 'void';
      expectedVersion: number; reason?: string;
    }>({
      queryFn: async ({ projectId, invoiceId, action, expectedVersion, reason }) => {
        await delay(180);
        const list = MOCK_INVOICES[projectId] ?? [];
        const inv = list.find((x) => x.id === invoiceId);
        if (!inv) return { error: { status: 404, error: 'INVOICE_NOT_FOUND' } };
        if (inv.version !== expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };
        if (action === 'reject' && (!reason || !reason.trim())) return { error: { status: 422, error: 'REASON_REQUIRED' } };
        if (action === 'void' && !['DRAFT', 'REJECTED'].includes(inv.status)) return { error: { status: 409, error: 'INVOICE_NOT_VOIDABLE' } };

        const statusMap: Record<string, InvoiceStatus> = {
          submit: 'SUBMITTED', approve: 'APPROVED', reject: 'REJECTED', void: 'VOID',
        };
        if (action !== 'void' && action !== 'reject') {
          if (!INV_TRANSITIONS[inv.status]?.includes(statusMap[action]!)) {
            return { error: { status: 409, error: 'INVOICE_INVALID_TRANSITION' } };
          }
        }
        const now = new Date().toISOString();
        const updated: InvoiceDTO = {
          ...inv,
          status: statusMap[action]!,
          version: inv.version + 1,
          updatedAt: now,
          submittedBy: action === 'submit' ? 'usr_01' : inv.submittedBy,
          submittedAt: action === 'submit' ? now : inv.submittedAt,
          approvedBy: action === 'approve' ? 'usr_01' : inv.approvedBy,
          approvedAt: action === 'approve' ? now : inv.approvedAt,
          rejectedBy: action === 'reject' ? 'usr_01' : inv.rejectedBy,
          rejectedAt: action === 'reject' ? now : inv.rejectedAt,
          rejectionReason: action === 'reject' ? (reason ?? null) : inv.rejectionReason,
          voidedBy: action === 'void' ? 'usr_01' : inv.voidedBy,
          voidedAt: action === 'void' ? now : inv.voidedAt,
        };
        MOCK_INVOICES[projectId] = list.map((x) => x.id === invoiceId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, invoiceId }) => [
        { type: 'Invoice', id: invoiceId }, { type: 'Invoice', id: projectId },
        { type: 'FinancialSummary', id: projectId },
      ],
    }),

    // ══ PAYMENTS ═══════════════════════════════════════════════════════════

    listPayments: build.query<{ items: PaymentDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; invoiceId?: string; status?: PaymentStatus }>({
      queryFn: async ({ projectId, invoiceId, status }) => {
        await delay();
        let items = MOCK_PAYMENTS[projectId] ?? [];
        if (invoiceId) items = items.filter((p) => p.invoiceId === invoiceId);
        if (status) items = items.filter((p) => p.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Payment', id: projectId }],
    }),

    getPayment: build.query<PaymentDTO, { orgId: string; projectId: string; paymentId: string }>({
      queryFn: async ({ projectId, paymentId }) => {
        await delay(120);
        const p = (MOCK_PAYMENTS[projectId] ?? []).find((x) => x.id === paymentId);
        if (!p) return { error: { status: 404, error: 'PAYMENT_NOT_FOUND' } };
        return { data: p };
      },
      providesTags: (_r, _e, { paymentId }) => [{ type: 'Payment', id: paymentId }],
    }),

    createPayment: build.mutation<PaymentDTO, { orgId: string; projectId: string; invoiceId: string; input: CreatePaymentInput }>({
      queryFn: async ({ orgId, projectId, invoiceId, input }) => {
        await delay(220);
        const now = new Date().toISOString();
        const num = `PMT-${new Date().getFullYear()}-${String((MOCK_PAYMENTS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const pmt: PaymentDTO = {
          id: `pmt_${Date.now()}`,
          organizationId: orgId,
          projectId,
          invoiceId,
          paymentNumber: num,
          status: 'DRAFT',
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          amount: input.amount,
          currencyCode: input.currencyCode,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          version: 1,
          createdBy: 'usr_01',
          submittedBy: null, submittedAt: null,
          approvedBy: null, approvedAt: null,
          rejectedBy: null, rejectedAt: null, rejectionReason: null,
          executedBy: null, executedAt: null,
          voidedBy: null, voidedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_PAYMENTS[projectId] = [...(MOCK_PAYMENTS[projectId] ?? []), pmt];
        return { data: pmt };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Payment', id: projectId }],
    }),

    transitionPayment: build.mutation<PaymentDTO, {
      orgId: string; projectId: string; paymentId: string;
      action: 'submit' | 'approve' | 'reject' | 'execute' | 'void';
      expectedVersion: number; reason?: string;
    }>({
      queryFn: async ({ projectId, paymentId, action, expectedVersion, reason }) => {
        await delay(200);
        const list = MOCK_PAYMENTS[projectId] ?? [];
        const pmt = list.find((x) => x.id === paymentId);
        if (!pmt) return { error: { status: 404, error: 'PAYMENT_NOT_FOUND' } };
        if (pmt.version !== expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };
        if (action === 'reject' && (!reason || !reason.trim())) return { error: { status: 422, error: 'REASON_REQUIRED' } };
        if (action === 'void' && pmt.status !== 'EXECUTED') return { error: { status: 409, error: 'PAYMENT_NOT_VOIDABLE' } };

        const statusMap: Record<string, PaymentStatus> = {
          submit: 'SUBMITTED', approve: 'APPROVED', reject: 'REJECTED',
          execute: 'EXECUTED', void: 'VOID',
        };
        if (!['reject', 'void'].includes(action)) {
          if (!PMT_TRANSITIONS[pmt.status]?.includes(statusMap[action]!)) {
            return { error: { status: 409, error: 'PAYMENT_INVALID_TRANSITION' } };
          }
        }
        const now = new Date().toISOString();
        const updated: PaymentDTO = {
          ...pmt,
          status: statusMap[action]!,
          version: pmt.version + 1,
          updatedAt: now,
          submittedBy: action === 'submit' ? 'usr_01' : pmt.submittedBy,
          submittedAt: action === 'submit' ? now : pmt.submittedAt,
          approvedBy: action === 'approve' ? 'usr_01' : pmt.approvedBy,
          approvedAt: action === 'approve' ? now : pmt.approvedAt,
          rejectedBy: action === 'reject' ? 'usr_01' : pmt.rejectedBy,
          rejectedAt: action === 'reject' ? now : pmt.rejectedAt,
          rejectionReason: action === 'reject' ? (reason ?? null) : pmt.rejectionReason,
          executedBy: action === 'execute' ? 'usr_01' : pmt.executedBy,
          executedAt: action === 'execute' ? now : pmt.executedAt,
          voidedBy: action === 'void' ? 'usr_01' : pmt.voidedBy,
          voidedAt: action === 'void' ? now : pmt.voidedAt,
        };
        // Update invoice paidAmount when executed
        if (action === 'execute') {
          const invList = MOCK_INVOICES[projectId] ?? [];
          const inv = invList.find((x) => x.id === pmt.invoiceId);
          if (inv) {
            const newPaid = (parseFloat(inv.paidAmount) + parseFloat(pmt.amount)).toFixed(2);
            const newOutstanding = Math.max(0, parseFloat(inv.totalAmount) - parseFloat(newPaid)).toFixed(2);
            MOCK_INVOICES[projectId] = invList.map((x) =>
              x.id === pmt.invoiceId ? { ...x, paidAmount: newPaid, outstandingAmount: newOutstanding } : x,
            );
          }
        }
        MOCK_PAYMENTS[projectId] = list.map((x) => x.id === paymentId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, paymentId }) => [
        { type: 'Payment', id: paymentId }, { type: 'Payment', id: projectId },
        { type: 'Invoice', id: projectId }, { type: 'FinancialSummary', id: projectId },
      ],
    }),

    // ══ RETAINAGE ══════════════════════════════════════════════════════════

    listRetainage: build.query<{ items: RetainageDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay();
        return { data: { items: MOCK_RETAINAGE[projectId] ?? [] } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Retainage', id: projectId }],
    }),

    holdRetainage: build.mutation<RetainageDTO, { orgId: string; projectId: string; paymentApplicationId: string }>({
      queryFn: async ({ orgId, projectId, paymentApplicationId }) => {
        await delay(220);
        const pa = (MOCK_PAYMENT_APPLICATIONS[projectId] ?? []).find((x) => x.id === paymentApplicationId);
        if (!pa) return { error: { status: 404, error: 'PA_NOT_FOUND' } };
        if (pa.status !== 'APPROVED') return { error: { status: 409, error: 'PA_NOT_APPROVED' } };
        const now = new Date().toISOString();
        const ret: RetainageDTO = {
          id: `ret_${Date.now()}`,
          organizationId: orgId,
          projectId,
          paymentApplicationId,
          heldAmount: pa.retainageAmount,
          releasedAmount: '0.00',
          remainingAmount: pa.retainageAmount,
          currencyCode: pa.currencyCode,
          status: 'HELD',
          version: 1,
          heldBy: 'usr_01',
          heldAt: now,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_RETAINAGE[projectId] = [...(MOCK_RETAINAGE[projectId] ?? []), ret];
        MOCK_RETAINAGE_RELEASES[ret.id] = [];
        return { data: ret };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Retainage', id: projectId }],
    }),

    listRetainageReleases: build.query<{ items: RetainageReleaseDTO[] }, { orgId: string; projectId: string; retainageId: string }>({
      queryFn: async ({ retainageId }) => {
        await delay(100);
        return { data: { items: MOCK_RETAINAGE_RELEASES[retainageId] ?? [] } };
      },
      providesTags: (_r, _e, { retainageId }) => [{ type: 'RetainageRelease', id: retainageId }],
    }),

    releaseRetainage: build.mutation<RetainageDTO, {
      orgId: string; projectId: string; retainageId: string;
      expectedVersion: number; amount: string; reason: string;
    }>({
      queryFn: async ({ projectId, retainageId, expectedVersion, amount, reason }) => {
        await delay(220);
        if (!reason.trim()) return { error: { status: 422, error: 'REASON_REQUIRED' } };
        const list = MOCK_RETAINAGE[projectId] ?? [];
        const ret = list.find((x) => x.id === retainageId);
        if (!ret) return { error: { status: 404, error: 'RETAINAGE_NOT_FOUND' } };
        if (ret.version !== expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };
        const releaseAmt = parseFloat(amount);
        if (isNaN(releaseAmt) || releaseAmt <= 0) return { error: { status: 422, error: 'INVALID_AMOUNT' } };
        if (releaseAmt > parseFloat(ret.remainingAmount)) return { error: { status: 409, error: 'RELEASE_EXCEEDS_HELD' } };
        const now = new Date().toISOString();
        const newReleased = (parseFloat(ret.releasedAmount) + releaseAmt).toFixed(2);
        const newRemaining = (parseFloat(ret.remainingAmount) - releaseAmt).toFixed(2);
        const updated: RetainageDTO = {
          ...ret,
          releasedAmount: newReleased,
          remainingAmount: newRemaining,
          status: parseFloat(newRemaining) === 0 ? 'FULLY_RELEASED' : 'PARTIALLY_RELEASED',
          version: ret.version + 1,
          updatedAt: now,
        };
        MOCK_RETAINAGE[projectId] = list.map((x) => x.id === retainageId ? updated : x);
        const releaseRecord: RetainageReleaseDTO = {
          id: `rel_${Date.now()}`,
          retainageId,
          amount,
          currencyCode: ret.currencyCode,
          reason,
          releasedBy: 'usr_01',
          releasedAt: now,
          createdAt: now,
        };
        MOCK_RETAINAGE_RELEASES[retainageId] = [...(MOCK_RETAINAGE_RELEASES[retainageId] ?? []), releaseRecord];
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, retainageId }) => [
        { type: 'Retainage', id: projectId },
        { type: 'RetainageRelease', id: retainageId },
      ],
    }),

    // ══ COST TRANSACTIONS ══════════════════════════════════════════════════

    listCostTransactions: build.query<{ transactions: CostTransactionDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: CostTransactionStatus; costCodeId?: string }>({
      queryFn: async ({ projectId, status, costCodeId }) => {
        await delay();
        let items = MOCK_COST_TRANSACTIONS[projectId] ?? [];
        if (status) items = items.filter((t) => t.status === status);
        if (costCodeId) items = items.filter((t) => t.costCodeId === costCodeId);
        return { data: { transactions: items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'CostTransaction', id: projectId }],
    }),

    getCostTransaction: build.query<CostTransactionDTO, { orgId: string; projectId: string; transactionId: string }>({
      queryFn: async ({ projectId, transactionId }) => {
        await delay(120);
        const t = (MOCK_COST_TRANSACTIONS[projectId] ?? []).find((x) => x.id === transactionId);
        if (!t) return { error: { status: 404, error: 'TRANSACTION_NOT_FOUND' } };
        return { data: t };
      },
      providesTags: (_r, _e, { transactionId }) => [{ type: 'CostTransaction', id: transactionId }],
    }),

    createCostTransaction: build.mutation<CostTransactionDTO, { orgId: string; projectId: string; input: CreateCostTransactionInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(220);
        const now = new Date().toISOString();
        // If subtotal not provided, derive from qty * unitCost
        const subtotal = input.subtotal
          ? parseFloat(input.subtotal)
          : (input.quantity && input.unitCost ? parseFloat(input.quantity) * parseFloat(input.unitCost) : 0);
        const taxAmount = input.taxAmount ? parseFloat(input.taxAmount) : 0;
        const t: CostTransactionDTO = {
          id: `ct_${Date.now()}`,
          organizationId: orgId,
          projectId,
          costCodeId: input.costCodeId,
          phaseId: input.phaseId ?? null,
          taskId: input.taskId ?? null,
          documentId: input.documentId ?? null,
          sourceType: input.sourceType ?? 'MANUAL',
          sourceId: input.sourceId ?? null,
          transactionDate: input.transactionDate,
          postingDate: null,
          description: input.description,
          quantity: input.quantity ?? null,
          unit: input.unit ?? null,
          unitCost: input.unitCost ?? null,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: (subtotal + taxAmount).toFixed(2),
          currencyCode: input.currencyCode.toUpperCase(),
          status: 'DRAFT',
          createdBy: 'usr_01',
          postedBy: null, postedAt: null,
          voidedBy: null, voidedAt: null,
          version: 1,
          reversalId: null,
          createdAt: now,
        };
        MOCK_COST_TRANSACTIONS[projectId] = [...(MOCK_COST_TRANSACTIONS[projectId] ?? []), t];
        return { data: t };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CostTransaction', id: projectId }],
    }),

    postCostTransaction: build.mutation<CostTransactionDTO, { orgId: string; projectId: string; transactionId: string; expectedVersion: number }>({
      queryFn: async ({ projectId, transactionId, expectedVersion }) => {
        await delay(200);
        const list = MOCK_COST_TRANSACTIONS[projectId] ?? [];
        const t = list.find((x) => x.id === transactionId);
        if (!t) return { error: { status: 404, error: 'TRANSACTION_NOT_FOUND' } };
        if (t.version !== expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };
        if (t.status !== 'DRAFT') return { error: { status: 409, error: 'TRANSACTION_NOT_DRAFT' } };
        const now = new Date().toISOString();
        const updated = { ...t, status: 'POSTED' as CostTransactionStatus, postedBy: 'usr_01', postedAt: now, postingDate: t.transactionDate, version: t.version + 1 };
        MOCK_COST_TRANSACTIONS[projectId] = list.map((x) => x.id === transactionId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, transactionId }) => [
        { type: 'CostTransaction', id: transactionId },
        { type: 'CostTransaction', id: projectId },
        { type: 'CommercialSummary', id: projectId },
      ],
    }),

    voidCostTransaction: build.mutation<CostTransactionDTO, { orgId: string; projectId: string; transactionId: string; expectedVersion: number; reason: string }>({
      queryFn: async ({ projectId, transactionId, expectedVersion, reason }) => {
        await delay(200);
        if (!reason.trim()) return { error: { status: 422, error: 'REASON_REQUIRED' } };
        const list = MOCK_COST_TRANSACTIONS[projectId] ?? [];
        const t = list.find((x) => x.id === transactionId);
        if (!t) return { error: { status: 404, error: 'TRANSACTION_NOT_FOUND' } };
        if (t.version !== expectedVersion) return { error: { status: 409, error: 'VERSION_CONFLICT' } };
        if (t.status !== 'POSTED') return { error: { status: 409, error: 'TRANSACTION_NOT_POSTED' } };
        const now = new Date().toISOString();
        const updated = { ...t, status: 'VOIDED' as CostTransactionStatus, voidedBy: 'usr_01', voidedAt: now, version: t.version + 1 };
        MOCK_COST_TRANSACTIONS[projectId] = list.map((x) => x.id === transactionId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, transactionId }) => [
        { type: 'CostTransaction', id: transactionId },
        { type: 'CostTransaction', id: projectId },
        { type: 'CommercialSummary', id: projectId },
      ],
    }),

    // ══ COMMERCIAL SUMMARY (read-only) ════════════════════════════════════

    getCommercialSummary: build.query<CommercialSummaryDTO, { orgId: string; projectId: string; costCodeId?: string }>({
      queryFn: async ({ projectId }) => {
        await delay(200);
        const cos = MOCK_CHANGE_ORDERS[projectId] ?? [];
        const approvedChanges = cos
          .filter((c) => ['CLIENT_APPROVED', 'EFFECTED'].includes(c.status))
          .reduce((acc, c) => acc + parseFloat(c.lines.reduce((s, l) => s + parseFloat(l.amount), 0).toFixed(2)), 0);
        const txns = (MOCK_COST_TRANSACTIONS[projectId] ?? []).filter((t) => t.status === 'POSTED');
        const postedActual = txns.reduce((acc, t) => acc + parseFloat(t.totalAmount), 0);
        return {
          data: {
            costCode: null,
            currencyBreakdown: [{
              currencyCode: 'PKR',
              originalBudget: '285000000.00',
              approvedBudgetChanges: approvedChanges.toFixed(2),
              revisedBudget: (285000000 + approvedChanges).toFixed(2),
              committed: '0.00',
              postedActual: postedActual.toFixed(2),
              forecast: null,
              variance: null,
              approvedRevisionNumber: null,
            }],
            forecastBasis: null,
            forecastUnavailableReason: 'No approved forecast attached to this project.',
            commitmentCoverage: 'NO_POS',
            subcontractCommitments: '0.00',
            invoiceLifecycleCoverage: 'INVOICES_PRESENT',
          },
        };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'CommercialSummary', id: projectId }],
    }),

    // ══ FINANCIAL SUMMARY (read-only) ════════════════════════════════════

    getFinancialSummary: build.query<FinancialSummaryDTO, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay(200);
        const invs = MOCK_INVOICES[projectId] ?? [];
        const pmts = MOCK_PAYMENTS[projectId] ?? [];
        const txns = (MOCK_COST_TRANSACTIONS[projectId] ?? []).filter((t) => t.status === 'POSTED');
        const rets = MOCK_RETAINAGE[projectId] ?? [];

        const totalBilled = invs.filter((i) => !['VOID'].includes(i.status)).reduce((a, i) => a + parseFloat(i.totalAmount), 0);
        const totalApproved = invs.filter((i) => i.status === 'APPROVED').reduce((a, i) => a + parseFloat(i.totalAmount), 0);
        const totalReceived = pmts.filter((p) => p.status === 'EXECUTED').reduce((a, p) => a + parseFloat(p.amount), 0);
        const postedActual = txns.reduce((a, t) => a + parseFloat(t.totalAmount), 0);
        const retHeld = rets.reduce((a, r) => a + parseFloat(r.heldAmount), 0);
        const retReleased = rets.reduce((a, r) => a + parseFloat(r.releasedAmount), 0);

        const cost: CostSummaryDTO[] = [{
          currencyCode: 'PKR',
          directCost: postedActual.toFixed(2),
          overhead: '0.00',
          contingency: '0.00',
          totalCost: postedActual.toFixed(2),
          forecastCost: null,
          documentedForecastCoverage: 'NO_FORECAST',
        }];
        const commitments: CommitmentSummaryDTO[] = [{
          currencyCode: 'PKR',
          approvedPOTotal: '0.00',
          subcontractTotal: '0.00',
          totalCommitted: '0.00',
        }];
        const billing: BillingSummaryDTO[] = [{
          currencyCode: 'PKR',
          contractAmount: '285000000.00',
          approvedChanges: '0.00',
          revisedContractAmount: '285000000.00',
          totalBilled: totalBilled.toFixed(2),
          totalApproved: totalApproved.toFixed(2),
          totalOutstanding: (totalApproved - totalReceived).toFixed(2),
          retainageHeld: retHeld.toFixed(2),
          retainageReleased: retReleased.toFixed(2),
          netRetainage: (retHeld - retReleased).toFixed(2),
        }];
        const cash: CashSummaryDTO[] = [{
          currencyCode: 'PKR',
          totalReceived: totalReceived.toFixed(2),
          totalPaid: '0.00',
          netCash: totalReceived.toFixed(2),
        }];
        return { data: { cost, commitments, billing, cash } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'FinancialSummary', id: projectId }],
    }),

    getFinancialAudit: build.query<FinancialAuditPageDTO, { orgId: string; projectId: string; cursor?: string; limit?: number; entityType?: string }>({
      queryFn: async ({ projectId }) => {
        await delay(150);
        // Synthesise an audit trail from fixture state
        const events = [
          ...((MOCK_CHANGE_ORDERS[projectId] ?? []).flatMap((co) => [
            co.submittedAt && { id: `audit_co_sub_${co.id}`, projectId, entityType: 'ChangeOrder', entityId: co.id, action: 'SUBMITTED', actorId: co.submittedBy ?? 'usr_01', actorName: 'Tariq Mehmood', metadata: { changeOrderNumber: co.changeOrderNumber }, occurredAt: co.submittedAt },
            co.effectedAt && { id: `audit_co_eff_${co.id}`, projectId, entityType: 'ChangeOrder', entityId: co.id, action: 'EFFECTED', actorId: co.effectedBy ?? 'usr_01', actorName: 'Tariq Mehmood', metadata: { changeOrderNumber: co.changeOrderNumber }, occurredAt: co.effectedAt },
          ].filter(Boolean))),
          ...((MOCK_INVOICES[projectId] ?? []).flatMap((inv) => [
            inv.approvedAt && { id: `audit_inv_${inv.id}`, projectId, entityType: 'Invoice', entityId: inv.id, action: 'APPROVED', actorId: inv.approvedBy ?? 'usr_01', actorName: 'Tariq Mehmood', metadata: { invoiceNumber: inv.invoiceNumber, totalAmount: inv.totalAmount }, occurredAt: inv.approvedAt },
          ].filter(Boolean))),
          ...((MOCK_PAYMENTS[projectId] ?? []).flatMap((pmt) => [
            pmt.executedAt && { id: `audit_pmt_${pmt.id}`, projectId, entityType: 'Payment', entityId: pmt.id, action: 'EXECUTED', actorId: pmt.executedBy ?? 'usr_01', actorName: 'Tariq Mehmood', metadata: { paymentNumber: pmt.paymentNumber, amount: pmt.amount }, occurredAt: pmt.executedAt },
          ].filter(Boolean))),
        ] as FinancialAuditPageDTO['events'];
        events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
        return { data: { events, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'FinancialSummary', id: `audit_${projectId}` }],
    }),

  }),
});

export const {
  useListChangeOrdersQuery,
  useGetChangeOrderQuery,
  useCreateChangeOrderMutation,
  useUpdateChangeOrderMutation,
  useTransitionChangeOrderMutation,
  useListSOVsQuery,
  useGetSOVQuery,
  useGetSOVProgressQuery,
  useCreateSOVMutation,
  useTransitionSOVMutation,
  useListPaymentApplicationsQuery,
  useGetPaymentApplicationQuery,
  useCreatePaymentApplicationMutation,
  useTransitionPaymentApplicationMutation,
  useListInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
  useTransitionInvoiceMutation,
  useListPaymentsQuery,
  useGetPaymentQuery,
  useCreatePaymentMutation,
  useTransitionPaymentMutation,
  useListRetainageQuery,
  useHoldRetainageMutation,
  useListRetainageReleasesQuery,
  useReleaseRetainageMutation,
  useListCostTransactionsQuery,
  useGetCostTransactionQuery,
  useCreateCostTransactionMutation,
  usePostCostTransactionMutation,
  useVoidCostTransactionMutation,
  useGetCommercialSummaryQuery,
  useGetFinancialSummaryQuery,
  useGetFinancialAuditQuery,
} = commercialApi;
