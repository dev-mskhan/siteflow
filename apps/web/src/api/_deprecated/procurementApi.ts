/**
 * procurementApi — RTK Query slices for all Group 4 procurement entities.
 * Single createApi with tagTypes covering all 7 sub-domains:
 *   MaterialRequest, Quote, PurchaseOrder, ProcurementApproval,
 *   Delivery, Receipt, CommittedCost, Inventory
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  MaterialRequestDTO,
  CreateMaterialRequestInput,
  UpdateMaterialRequestInput,
  QuoteDTO,
  CreateQuoteInput,
  UpdateQuoteInput,
  PurchaseOrderDTO,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderStatus,
  ProcurementApprovalDTO,
  CreateApprovalInput,
  ReviewApprovalInput,
  DeliveryDTO,
  CreateDeliveryInput,
  UpdateDeliveryInput,
  ReceiptDTO,
  CreateReceiptInput,
  CommittedCostDTO,
  InventoryBalanceDTO,
  InventoryTransactionDTO,
  AdjustInventoryInput,
} from '../types/procurementTypes';
import {
  MOCK_MATERIAL_REQUESTS,
  MOCK_QUOTES,
  MOCK_PURCHASE_ORDERS,
  MOCK_PROCUREMENT_APPROVALS,
  MOCK_DELIVERIES,
  MOCK_RECEIPTS,
  MOCK_COMMITTED_COSTS,
  MOCK_INVENTORY,
  MOCK_INVENTORY_TRANSACTIONS,
} from '../fixtures/procurement.fixtures';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

// ── Helper: find in mutable fixture array ─────────────────────────────────────

function findInProject<T extends { id: string; projectId: string }>(
  map: Record<string, T[]>,
  projectId: string,
  id: string,
): T | undefined {
  return map[projectId]?.find((x) => x.id === id);
}

// ── Transition guard maps ─────────────────────────────────────────────────────

const MR_CANCELLABLE = new Set(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED']);
const PO_CANCELLABLE = new Set(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT']);

// ─────────────────────────────────────────────────────────────────────────────

export const procurementApi = createApi({
  reducerPath: 'procurementApi',
  baseQuery: mockBaseQuery,
  tagTypes: [
    'MR', 'Quote', 'PO', 'Approval', 'Delivery', 'Receipt', 'CommittedCost', 'Inventory', 'Performance',
  ],
  endpoints: (build) => ({

    // ── Material Requests ────────────────────────────────────────────────────

    listMaterialRequests: build.query<{ data: MaterialRequestDTO[] }, { orgId: string; projectId: string; status?: string }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let data = MOCK_MATERIAL_REQUESTS[projectId] ?? [];
        if (status) data = data.filter((r) => r.status === status);
        return { data: { data } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'MR', id: projectId }],
    }),

    getMaterialRequest: build.query<MaterialRequestDTO, { orgId: string; projectId: string; requestId: string }>({
      queryFn: async ({ projectId, requestId }) => {
        await delay(120);
        const item = findInProject(MOCK_MATERIAL_REQUESTS, projectId, requestId);
        if (!item) return { error: { status: 404, error: 'MATERIAL_REQUEST_NOT_FOUND' } };
        return { data: item };
      },
      providesTags: (_r, _e, { requestId }) => [{ type: 'MR', id: requestId }],
    }),

    createMaterialRequest: build.mutation<MaterialRequestDTO, { orgId: string; projectId: string; input: CreateMaterialRequestInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(200);
        const num = `MR-202506-${String((MOCK_MATERIAL_REQUESTS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();
        const newMR: MaterialRequestDTO = {
          id: `mr_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          requestNumber: num,
          requestedByMemberId: 'mem_01',
          status: 'DRAFT',
          requiredByDate: input.requiredByDate ?? null,
          deliveryLocation: input.deliveryLocation ?? null,
          priority: input.priority ?? 'NORMAL',
          notes: input.notes ?? null,
          submittedAt: null,
          approvedAt: null,
          cancelledAt: null,
          items: input.items.map((item, i) => ({
            id: `mri_new_${i}`,
            organizationId: 'org_01',
            materialRequestId: `mr_${Date.now()}`,
            materialId: item.materialId,
            description: item.description ?? null,
            quantity: item.quantity,
            unitCode: item.unitCode.toUpperCase(),
            requiredByDate: item.requiredByDate ?? null,
            taskId: item.taskId ?? null,
            phaseId: item.phaseId ?? null,
            costCodeId: item.costCodeId ?? null,
            boqLineId: null,
            notes: item.notes ?? null,
            createdAt: now,
            updatedAt: now,
          })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_MATERIAL_REQUESTS[projectId] = [...(MOCK_MATERIAL_REQUESTS[projectId] ?? []), newMR];
        return { data: newMR };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'MR', id: projectId }],
    }),

    updateMaterialRequest: build.mutation<MaterialRequestDTO, { orgId: string; projectId: string; requestId: string; input: UpdateMaterialRequestInput }>({
      queryFn: async ({ projectId, requestId, input }) => {
        await delay(180);
        const item = findInProject(MOCK_MATERIAL_REQUESTS, projectId, requestId);
        if (!item) return { error: { status: 404, error: 'MATERIAL_REQUEST_NOT_FOUND' } };
        if (item.status !== 'DRAFT') return { error: { status: 422, error: 'MATERIAL_REQUEST_INVALID_STATE' } };
        const updated = { ...item, ...input, updatedAt: new Date().toISOString() };
        MOCK_MATERIAL_REQUESTS[projectId] = MOCK_MATERIAL_REQUESTS[projectId].map((r) => r.id === requestId ? updated : r);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, requestId }) => [{ type: 'MR', id: requestId }, { type: 'MR', id: projectId }],
    }),

    submitMaterialRequest: build.mutation<MaterialRequestDTO, { orgId: string; projectId: string; requestId: string }>({
      queryFn: async ({ projectId, requestId }) => {
        await delay(150);
        const item = findInProject(MOCK_MATERIAL_REQUESTS, projectId, requestId);
        if (!item) return { error: { status: 404, error: 'MATERIAL_REQUEST_NOT_FOUND' } };
        if (item.status !== 'DRAFT') return { error: { status: 422, error: 'MATERIAL_REQUEST_INVALID_STATE' } };
        if (item.items.length === 0) return { error: { status: 422, error: 'MATERIAL_REQUEST_NO_ITEMS' } };
        const updated = { ...item, status: 'SUBMITTED' as const, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        MOCK_MATERIAL_REQUESTS[projectId] = MOCK_MATERIAL_REQUESTS[projectId].map((r) => r.id === requestId ? updated : r);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, requestId }) => [{ type: 'MR', id: requestId }, { type: 'MR', id: projectId }],
    }),

    cancelMaterialRequest: build.mutation<MaterialRequestDTO, { orgId: string; projectId: string; requestId: string }>({
      queryFn: async ({ projectId, requestId }) => {
        await delay(150);
        const item = findInProject(MOCK_MATERIAL_REQUESTS, projectId, requestId);
        if (!item) return { error: { status: 404, error: 'MATERIAL_REQUEST_NOT_FOUND' } };
        if (!MR_CANCELLABLE.has(item.status)) return { error: { status: 422, error: 'MATERIAL_REQUEST_INVALID_STATE' } };
        const updated = { ...item, status: 'CANCELLED' as const, cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        MOCK_MATERIAL_REQUESTS[projectId] = MOCK_MATERIAL_REQUESTS[projectId].map((r) => r.id === requestId ? updated : r);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, requestId }) => [{ type: 'MR', id: requestId }, { type: 'MR', id: projectId }],
    }),

    // ── Quotes ───────────────────────────────────────────────────────────────

    listQuotes: build.query<{ data: QuoteDTO[] }, { orgId: string; projectId: string; status?: string }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let data = MOCK_QUOTES[projectId] ?? [];
        if (status) data = data.filter((q) => q.status === status);
        return { data: { data } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Quote', id: projectId }],
    }),

    getQuote: build.query<QuoteDTO, { orgId: string; projectId: string; quoteId: string }>({
      queryFn: async ({ projectId, quoteId }) => {
        await delay(120);
        const item = findInProject(MOCK_QUOTES, projectId, quoteId);
        if (!item) return { error: { status: 404, error: 'QUOTE_NOT_FOUND' } };
        return { data: item };
      },
      providesTags: (_r, _e, { quoteId }) => [{ type: 'Quote', id: quoteId }],
    }),

    createQuote: build.mutation<QuoteDTO, { orgId: string; projectId: string; input: CreateQuoteInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(200);
        const num = `QT-202506-${String((MOCK_QUOTES[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();
        const newQuote: QuoteDTO = {
          id: `qt_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          quoteNumber: num,
          supplierId: input.supplierId,
          materialRequestId: input.materialRequestId ?? null,
          status: 'DRAFT',
          quoteDate: input.quoteDate,
          validUntil: input.validUntil ?? null,
          currencyCode: input.currencyCode,
          subtotal: '0.00',
          discountAmount: '0.00',
          taxAmount: '0.00',
          totalAmount: '0.00',
          notes: input.notes ?? null,
          submittedAt: null,
          acceptedAt: null,
          rejectedAt: null,
          items: input.items.map((item, i) => ({
            id: `qti_new_${i}`,
            organizationId: 'org_01',
            quoteId: `qt_${Date.now()}`,
            materialRequestItemId: item.materialRequestItemId ?? null,
            materialId: item.materialId,
            description: item.description ?? null,
            quantity: item.quantity,
            unitCode: item.unitCode.toUpperCase(),
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount ?? '0.00',
            taxAmount: item.taxAmount ?? '0.00',
            lineSubtotal: String(parseFloat(item.quantity) * parseFloat(item.unitPrice)),
            lineTotal: String(parseFloat(item.quantity) * parseFloat(item.unitPrice)),
            expectedDeliveryDate: item.expectedDeliveryDate ?? null,
            createdAt: now,
            updatedAt: now,
          })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_QUOTES[projectId] = [...(MOCK_QUOTES[projectId] ?? []), newQuote];
        return { data: newQuote };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Quote', id: projectId }],
    }),

    updateQuote: build.mutation<QuoteDTO, { orgId: string; projectId: string; quoteId: string; input: UpdateQuoteInput }>({
      queryFn: async ({ projectId, quoteId, input }) => {
        await delay(180);
        const item = findInProject(MOCK_QUOTES, projectId, quoteId);
        if (!item) return { error: { status: 404, error: 'QUOTE_NOT_FOUND' } };
        if (item.status === 'ACCEPTED') return { error: { status: 422, error: 'QUOTE_INVALID_STATE' } };
        const updated = { ...item, ...input, updatedAt: new Date().toISOString() };
        MOCK_QUOTES[projectId] = MOCK_QUOTES[projectId].map((q) => q.id === quoteId ? updated : q);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, quoteId }) => [{ type: 'Quote', id: quoteId }, { type: 'Quote', id: projectId }],
    }),

    submitQuote: build.mutation<QuoteDTO, { orgId: string; projectId: string; quoteId: string }>({
      queryFn: async ({ projectId, quoteId }) => {
        await delay(150);
        const item = findInProject(MOCK_QUOTES, projectId, quoteId);
        if (!item) return { error: { status: 404, error: 'QUOTE_NOT_FOUND' } };
        if (item.status !== 'DRAFT') return { error: { status: 422, error: 'QUOTE_INVALID_STATE' } };
        const updated = { ...item, status: 'SUBMITTED' as const, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        MOCK_QUOTES[projectId] = MOCK_QUOTES[projectId].map((q) => q.id === quoteId ? updated : q);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, quoteId }) => [{ type: 'Quote', id: quoteId }, { type: 'Quote', id: projectId }],
    }),

    acceptQuote: build.mutation<QuoteDTO, { orgId: string; projectId: string; quoteId: string }>({
      queryFn: async ({ projectId, quoteId }) => {
        await delay(150);
        const item = findInProject(MOCK_QUOTES, projectId, quoteId);
        if (!item) return { error: { status: 404, error: 'QUOTE_NOT_FOUND' } };
        if (item.status === 'ACCEPTED') return { data: item };
        if (item.status !== 'SUBMITTED') return { error: { status: 422, error: 'QUOTE_INVALID_STATE' } };
        if (item.validUntil && item.validUntil < new Date().toISOString().split('T')[0]!) {
          return { error: { status: 422, error: 'QUOTE_EXPIRED' } };
        }
        const updated = { ...item, status: 'ACCEPTED' as const, acceptedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        MOCK_QUOTES[projectId] = MOCK_QUOTES[projectId].map((q) => q.id === quoteId ? updated : q);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, quoteId }) => [{ type: 'Quote', id: quoteId }, { type: 'Quote', id: projectId }],
    }),

    rejectQuote: build.mutation<QuoteDTO, { orgId: string; projectId: string; quoteId: string }>({
      queryFn: async ({ projectId, quoteId }) => {
        await delay(150);
        const item = findInProject(MOCK_QUOTES, projectId, quoteId);
        if (!item) return { error: { status: 404, error: 'QUOTE_NOT_FOUND' } };
        if (!['DRAFT', 'SUBMITTED'].includes(item.status)) return { error: { status: 422, error: 'QUOTE_INVALID_STATE' } };
        const updated = { ...item, status: 'REJECTED' as const, rejectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        MOCK_QUOTES[projectId] = MOCK_QUOTES[projectId].map((q) => q.id === quoteId ? updated : q);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, quoteId }) => [{ type: 'Quote', id: quoteId }, { type: 'Quote', id: projectId }],
    }),

    // ── Purchase Orders ──────────────────────────────────────────────────────

    listPurchaseOrders: build.query<{ data: PurchaseOrderDTO[] }, { orgId: string; projectId: string; status?: PurchaseOrderStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let data = MOCK_PURCHASE_ORDERS[projectId] ?? [];
        if (status) data = data.filter((p) => p.status === status);
        return { data: { data } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'PO', id: projectId }],
    }),

    getPurchaseOrder: build.query<PurchaseOrderDTO, { orgId: string; projectId: string; poId: string }>({
      queryFn: async ({ projectId, poId }) => {
        await delay(120);
        const item = findInProject(MOCK_PURCHASE_ORDERS, projectId, poId);
        if (!item) return { error: { status: 404, error: 'PURCHASE_ORDER_NOT_FOUND' } };
        return { data: item };
      },
      providesTags: (_r, _e, { poId }) => [{ type: 'PO', id: poId }],
    }),

    createPurchaseOrder: build.mutation<PurchaseOrderDTO, { orgId: string; projectId: string; input: CreatePurchaseOrderInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(200);
        const num = `PO-202506-${String((MOCK_PURCHASE_ORDERS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();
        const newPO: PurchaseOrderDTO = {
          id: `po_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          poNumber: num,
          supplierId: input.supplierId,
          materialRequestId: input.materialRequestId ?? null,
          sourceQuoteId: input.sourceQuoteId ?? null,
          status: 'DRAFT',
          orderDate: input.orderDate,
          expectedDeliveryDate: input.expectedDeliveryDate ?? null,
          deliveryLocation: input.deliveryLocation ?? null,
          currencyCode: input.currencyCode,
          subtotal: '0.00',
          discountAmount: '0.00',
          taxAmount: '0.00',
          totalAmount: '0.00',
          notes: input.notes ?? null,
          createdByMemberId: 'mem_01',
          approvedAt: null,
          approvedBy: null,
          sentAt: null,
          cancelledAt: null,
          items: input.items.map((item, i) => ({
            id: `poi_new_${i}`,
            organizationId: 'org_01',
            purchaseOrderId: `po_${Date.now()}`,
            materialId: item.materialId,
            description: item.description ?? null,
            quantity: item.quantity,
            unitCode: item.unitCode.toUpperCase(),
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount ?? '0.00',
            taxAmount: item.taxAmount ?? '0.00',
            lineSubtotal: String(parseFloat(item.quantity) * parseFloat(item.unitPrice)),
            lineTotal: String(parseFloat(item.quantity) * parseFloat(item.unitPrice)),
            materialRequestItemId: item.materialRequestItemId ?? null,
            sourceQuoteItemId: item.sourceQuoteItemId ?? null,
            taskId: item.taskId ?? null,
            phaseId: item.phaseId ?? null,
            costCodeId: item.costCodeId ?? null,
            boqLineId: null,
            expectedDeliveryDate: item.expectedDeliveryDate ?? null,
            createdAt: now,
            updatedAt: now,
          })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_PURCHASE_ORDERS[projectId] = [...(MOCK_PURCHASE_ORDERS[projectId] ?? []), newPO];
        return { data: newPO };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'PO', id: projectId }],
    }),

    updatePurchaseOrder: build.mutation<PurchaseOrderDTO, { orgId: string; projectId: string; poId: string; input: UpdatePurchaseOrderInput }>({
      queryFn: async ({ projectId, poId, input }) => {
        await delay(180);
        const item = findInProject(MOCK_PURCHASE_ORDERS, projectId, poId);
        if (!item) return { error: { status: 404, error: 'PURCHASE_ORDER_NOT_FOUND' } };
        const postApproved = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(item.status);
        if (postApproved) {
          const allowed = new Set(['expectedDeliveryDate', 'deliveryLocation', 'notes']);
          const bad = Object.keys(input).find((k) => !allowed.has(k));
          if (bad) return { error: { status: 422, error: 'PURCHASE_ORDER_IMMUTABLE_FIELD' } };
        }
        const updated = { ...item, ...input, updatedAt: new Date().toISOString() };
        MOCK_PURCHASE_ORDERS[projectId] = MOCK_PURCHASE_ORDERS[projectId].map((p) => p.id === poId ? updated : p);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, poId }) => [{ type: 'PO', id: poId }, { type: 'PO', id: projectId }],
    }),

    submitPurchaseOrder: build.mutation<PurchaseOrderDTO, { orgId: string; projectId: string; poId: string }>({
      queryFn: async ({ projectId, poId }) => {
        await delay(150);
        const item = findInProject(MOCK_PURCHASE_ORDERS, projectId, poId);
        if (!item) return { error: { status: 404, error: 'PURCHASE_ORDER_NOT_FOUND' } };
        if (item.status !== 'DRAFT') return { error: { status: 422, error: 'PURCHASE_ORDER_INVALID_STATE' } };
        const updated = { ...item, status: 'PENDING_APPROVAL' as const, updatedAt: new Date().toISOString() };
        MOCK_PURCHASE_ORDERS[projectId] = MOCK_PURCHASE_ORDERS[projectId].map((p) => p.id === poId ? updated : p);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, poId }) => [{ type: 'PO', id: poId }, { type: 'PO', id: projectId }],
    }),

    approvePurchaseOrder: build.mutation<PurchaseOrderDTO, { orgId: string; projectId: string; poId: string }>({
      queryFn: async ({ projectId, poId }) => {
        await delay(150);
        const item = findInProject(MOCK_PURCHASE_ORDERS, projectId, poId);
        if (!item) return { error: { status: 404, error: 'PURCHASE_ORDER_NOT_FOUND' } };
        if (item.status === 'APPROVED') return { data: item };
        if (item.status !== 'PENDING_APPROVAL') return { error: { status: 422, error: 'PURCHASE_ORDER_INVALID_STATE' } };
        const updated = { ...item, status: 'APPROVED' as const, approvedAt: new Date().toISOString(), approvedBy: 'usr_01', updatedAt: new Date().toISOString() };
        MOCK_PURCHASE_ORDERS[projectId] = MOCK_PURCHASE_ORDERS[projectId].map((p) => p.id === poId ? updated : p);
        // Auto-create committed cost
        const cc: CommittedCostDTO = {
          id: `cc_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          sourceType: 'PURCHASE_ORDER',
          sourceId: poId,
          supplierId: item.supplierId,
          purchaseOrderId: poId,
          costCodeId: null,
          taskId: null,
          boqLineId: null,
          currencyCode: item.currencyCode,
          committedAmount: item.totalAmount,
          status: 'ACTIVE',
          lifecycleStatus: 'APPROVED',
          purchaseOrderStatus: 'APPROVED',
          committedAt: new Date().toISOString(),
          releasedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        MOCK_COMMITTED_COSTS[projectId] = [...(MOCK_COMMITTED_COSTS[projectId] ?? []), cc];
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, poId }) => [
        { type: 'PO', id: poId }, { type: 'PO', id: projectId }, { type: 'CommittedCost', id: projectId },
      ],
    }),

    sendPurchaseOrder: build.mutation<PurchaseOrderDTO, { orgId: string; projectId: string; poId: string }>({
      queryFn: async ({ projectId, poId }) => {
        await delay(150);
        const item = findInProject(MOCK_PURCHASE_ORDERS, projectId, poId);
        if (!item) return { error: { status: 404, error: 'PURCHASE_ORDER_NOT_FOUND' } };
        if (item.status !== 'APPROVED') return { error: { status: 422, error: 'PURCHASE_ORDER_INVALID_STATE' } };
        const updated = { ...item, status: 'SENT' as const, sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        MOCK_PURCHASE_ORDERS[projectId] = MOCK_PURCHASE_ORDERS[projectId].map((p) => p.id === poId ? updated : p);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, poId }) => [{ type: 'PO', id: poId }, { type: 'PO', id: projectId }],
    }),

    cancelPurchaseOrder: build.mutation<PurchaseOrderDTO, { orgId: string; projectId: string; poId: string }>({
      queryFn: async ({ projectId, poId }) => {
        await delay(150);
        const item = findInProject(MOCK_PURCHASE_ORDERS, projectId, poId);
        if (!item) return { error: { status: 404, error: 'PURCHASE_ORDER_NOT_FOUND' } };
        if (!PO_CANCELLABLE.has(item.status)) return { error: { status: 422, error: 'PURCHASE_ORDER_INVALID_STATE' } };
        const updated = { ...item, status: 'CANCELLED' as const, cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        MOCK_PURCHASE_ORDERS[projectId] = MOCK_PURCHASE_ORDERS[projectId].map((p) => p.id === poId ? updated : p);
        // Cancel committed cost
        MOCK_COMMITTED_COSTS[projectId] = (MOCK_COMMITTED_COSTS[projectId] ?? []).map((cc) =>
          cc.purchaseOrderId === poId ? { ...cc, status: 'CANCELLED' as const, lifecycleStatus: 'CANCELLED' as const, releasedAt: new Date().toISOString() } : cc
        );
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, poId }) => [
        { type: 'PO', id: poId }, { type: 'PO', id: projectId }, { type: 'CommittedCost', id: projectId },
      ],
    }),

    // ── Procurement Approvals ────────────────────────────────────────────────

    listApprovals: build.query<{ data: ProcurementApprovalDTO[] }, { orgId: string; projectId: string; status?: string }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let data = MOCK_PROCUREMENT_APPROVALS[projectId] ?? [];
        if (status) data = data.filter((a) => a.status === status);
        return { data: { data } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Approval', id: projectId }],
    }),

    getApproval: build.query<ProcurementApprovalDTO, { orgId: string; projectId: string; approvalId: string }>({
      queryFn: async ({ projectId, approvalId }) => {
        await delay(120);
        const item = findInProject(MOCK_PROCUREMENT_APPROVALS, projectId, approvalId);
        if (!item) return { error: { status: 404, error: 'PROCUREMENT_APPROVAL_NOT_FOUND' } };
        return { data: item };
      },
      providesTags: (_r, _e, { approvalId }) => [{ type: 'Approval', id: approvalId }],
    }),

    createApproval: build.mutation<ProcurementApprovalDTO, { orgId: string; projectId: string; input: CreateApprovalInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(200);
        const existing = (MOCK_PROCUREMENT_APPROVALS[projectId] ?? []).find(
          (a) => a.resourceId === input.resourceId && a.status === 'PENDING'
        );
        if (existing) return { error: { status: 409, error: 'PROCUREMENT_APPROVAL_DUPLICATE_PENDING' } };
        const now = new Date().toISOString();
        const newApproval: ProcurementApprovalDTO = {
          id: `appr_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          status: 'PENDING',
          requestedBy: 'usr_01',
          requestedAt: now,
          reviewedBy: null,
          reviewedAt: null,
          decisionReason: null,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_PROCUREMENT_APPROVALS[projectId] = [...(MOCK_PROCUREMENT_APPROVALS[projectId] ?? []), newApproval];
        return { data: newApproval };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Approval', id: projectId }],
    }),

    approveApproval: build.mutation<ProcurementApprovalDTO, { orgId: string; projectId: string; approvalId: string; input: ReviewApprovalInput }>({
      queryFn: async ({ projectId, approvalId, input }) => {
        await delay(200);
        const item = findInProject(MOCK_PROCUREMENT_APPROVALS, projectId, approvalId);
        if (!item) return { error: { status: 404, error: 'PROCUREMENT_APPROVAL_NOT_FOUND' } };
        if (item.status === 'APPROVED') return { data: item };
        if (item.status !== 'PENDING') return { error: { status: 422, error: 'PROCUREMENT_APPROVAL_INVALID_STATE' } };
        const now = new Date().toISOString();
        const updated = { ...item, status: 'APPROVED' as const, reviewedBy: 'usr_01', reviewedAt: now, decisionReason: input.decisionReason ?? null, updatedAt: now };
        MOCK_PROCUREMENT_APPROVALS[projectId] = MOCK_PROCUREMENT_APPROVALS[projectId].map((a) => a.id === approvalId ? updated : a);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, approvalId }) => [
        { type: 'Approval', id: approvalId }, { type: 'Approval', id: projectId },
        { type: 'MR', id: projectId }, { type: 'Quote', id: projectId }, { type: 'PO', id: projectId },
      ],
    }),

    rejectApproval: build.mutation<ProcurementApprovalDTO, { orgId: string; projectId: string; approvalId: string; input: ReviewApprovalInput }>({
      queryFn: async ({ projectId, approvalId, input }) => {
        await delay(200);
        const item = findInProject(MOCK_PROCUREMENT_APPROVALS, projectId, approvalId);
        if (!item) return { error: { status: 404, error: 'PROCUREMENT_APPROVAL_NOT_FOUND' } };
        if (item.status !== 'PENDING') return { error: { status: 422, error: 'PROCUREMENT_APPROVAL_INVALID_STATE' } };
        const now = new Date().toISOString();
        const updated = { ...item, status: 'REJECTED' as const, reviewedBy: 'usr_01', reviewedAt: now, decisionReason: input.decisionReason ?? null, updatedAt: now };
        MOCK_PROCUREMENT_APPROVALS[projectId] = MOCK_PROCUREMENT_APPROVALS[projectId].map((a) => a.id === approvalId ? updated : a);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, approvalId }) => [
        { type: 'Approval', id: approvalId }, { type: 'Approval', id: projectId },
      ],
    }),

    cancelApproval: build.mutation<ProcurementApprovalDTO, { orgId: string; projectId: string; approvalId: string }>({
      queryFn: async ({ projectId, approvalId }) => {
        await delay(150);
        const item = findInProject(MOCK_PROCUREMENT_APPROVALS, projectId, approvalId);
        if (!item) return { error: { status: 404, error: 'PROCUREMENT_APPROVAL_NOT_FOUND' } };
        if (item.status !== 'PENDING') return { error: { status: 422, error: 'PROCUREMENT_APPROVAL_INVALID_STATE' } };
        const updated = { ...item, status: 'CANCELLED' as const, updatedAt: new Date().toISOString() };
        MOCK_PROCUREMENT_APPROVALS[projectId] = MOCK_PROCUREMENT_APPROVALS[projectId].map((a) => a.id === approvalId ? updated : a);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, approvalId }) => [{ type: 'Approval', id: approvalId }, { type: 'Approval', id: projectId }],
    }),

    // ── Deliveries ───────────────────────────────────────────────────────────

    listDeliveries: build.query<{ data: DeliveryDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay();
        return { data: { data: MOCK_DELIVERIES[projectId] ?? [] } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Delivery', id: projectId }],
    }),

    getDelivery: build.query<DeliveryDTO, { orgId: string; projectId: string; deliveryId: string }>({
      queryFn: async ({ projectId, deliveryId }) => {
        await delay(120);
        const item = findInProject(MOCK_DELIVERIES, projectId, deliveryId);
        if (!item) return { error: { status: 404, error: 'DELIVERY_NOT_FOUND' } };
        return { data: item };
      },
      providesTags: (_r, _e, { deliveryId }) => [{ type: 'Delivery', id: deliveryId }],
    }),

    createDelivery: build.mutation<DeliveryDTO, { orgId: string; projectId: string; input: CreateDeliveryInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(200);
        const num = `DL-202506-${String((MOCK_DELIVERIES[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();
        const newDelivery: DeliveryDTO = {
          id: `dl_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          purchaseOrderId: input.purchaseOrderId,
          deliveryNumber: num,
          status: 'SCHEDULED',
          scheduledDate: input.scheduledDate ?? null,
          actualDeliveryDate: null,
          supplierReference: input.supplierReference ?? null,
          carrier: input.carrier ?? null,
          trackingReference: input.trackingReference ?? null,
          notes: input.notes ?? null,
          items: input.items.map((item, i) => ({
            id: `dli_new_${i}`,
            organizationId: 'org_01',
            deliveryId: `dl_${Date.now()}`,
            purchaseOrderItemId: item.purchaseOrderItemId,
            quantity: item.quantity,
            unitCode: item.unitCode.toUpperCase(),
            notes: item.notes ?? null,
          })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_DELIVERIES[projectId] = [...(MOCK_DELIVERIES[projectId] ?? []), newDelivery];
        return { data: newDelivery };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Delivery', id: projectId }],
    }),

    updateDelivery: build.mutation<DeliveryDTO, { orgId: string; projectId: string; deliveryId: string; input: UpdateDeliveryInput }>({
      queryFn: async ({ projectId, deliveryId, input }) => {
        await delay(180);
        const item = findInProject(MOCK_DELIVERIES, projectId, deliveryId);
        if (!item) return { error: { status: 404, error: 'DELIVERY_NOT_FOUND' } };
        if (item.status === 'CANCELLED' && input.status === 'DELIVERED') {
          return { error: { status: 422, error: 'DELIVERY_INVALID_STATE' } };
        }
        const updated = { ...item, ...input, updatedAt: new Date().toISOString() };
        MOCK_DELIVERIES[projectId] = MOCK_DELIVERIES[projectId].map((d) => d.id === deliveryId ? updated : d);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, deliveryId }) => [{ type: 'Delivery', id: deliveryId }, { type: 'Delivery', id: projectId }],
    }),

    // ── Receipts ─────────────────────────────────────────────────────────────

    listReceipts: build.query<{ data: ReceiptDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay();
        return { data: { data: MOCK_RECEIPTS[projectId] ?? [] } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Receipt', id: projectId }],
    }),

    createReceipt: build.mutation<ReceiptDTO, { orgId: string; projectId: string; input: CreateReceiptInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(200);
        const num = `RC-202506-${String((MOCK_RECEIPTS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();
        const newReceipt: ReceiptDTO = {
          id: `rc_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          purchaseOrderId: input.purchaseOrderId,
          deliveryId: input.deliveryId ?? null,
          receiptNumber: num,
          status: 'DRAFT',
          receivedAt: input.receivedAt,
          receivedByMemberId: 'mem_01',
          notes: input.notes ?? null,
          items: input.items.map((item, i) => ({
            id: `rci_new_${i}`,
            organizationId: 'org_01',
            receiptId: `rc_${Date.now()}`,
            purchaseOrderItemId: item.purchaseOrderItemId,
            quantityDelivered: item.quantityDelivered,
            quantityAccepted: item.quantityAccepted,
            quantityRejected: item.quantityRejected ?? '0',
            unitCode: item.unitCode.toUpperCase(),
            rejectionReason: item.rejectionReason ?? null,
            condition: item.condition ?? null,
            notes: item.notes ?? null,
          })),
          createdAt: now,
        };
        MOCK_RECEIPTS[projectId] = [...(MOCK_RECEIPTS[projectId] ?? []), newReceipt];
        return { data: newReceipt };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Receipt', id: projectId }],
    }),

    postReceipt: build.mutation<ReceiptDTO, { orgId: string; projectId: string; receiptId: string }>({
      queryFn: async ({ projectId, receiptId }) => {
        await delay(200);
        const item = MOCK_RECEIPTS[projectId]?.find((r) => r.id === receiptId);
        if (!item) return { error: { status: 404, error: 'RECEIPT_NOT_FOUND' } };
        if (item.status !== 'DRAFT') return { error: { status: 422, error: 'RECEIPT_INVALID_STATE' } };
        const updated = { ...item, status: 'POSTED' as const };
        MOCK_RECEIPTS[projectId] = MOCK_RECEIPTS[projectId].map((r) => r.id === receiptId ? updated : r);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Receipt', id: projectId }, { type: 'Inventory', id: projectId }],
    }),

    voidReceipt: build.mutation<ReceiptDTO, { orgId: string; projectId: string; receiptId: string }>({
      queryFn: async ({ projectId, receiptId }) => {
        await delay(200);
        const item = MOCK_RECEIPTS[projectId]?.find((r) => r.id === receiptId);
        if (!item) return { error: { status: 404, error: 'RECEIPT_NOT_FOUND' } };
        if (item.status !== 'POSTED') return { error: { status: 422, error: 'RECEIPT_INVALID_STATE' } };
        const updated = { ...item, status: 'VOIDED' as const };
        MOCK_RECEIPTS[projectId] = MOCK_RECEIPTS[projectId].map((r) => r.id === receiptId ? updated : r);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Receipt', id: projectId }, { type: 'Inventory', id: projectId }],
    }),

    // ── Committed Costs (read-only) ──────────────────────────────────────────

    listCommittedCosts: build.query<{ data: CommittedCostDTO[] }, { orgId: string; projectId: string; status?: string }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let data = MOCK_COMMITTED_COSTS[projectId] ?? [];
        if (status) data = data.filter((c) => c.status === status);
        return { data: { data } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'CommittedCost', id: projectId }],
    }),

    getCommittedCost: build.query<CommittedCostDTO, { orgId: string; projectId: string; committedCostId: string }>({
      queryFn: async ({ projectId, committedCostId }) => {
        await delay(120);
        const item = (MOCK_COMMITTED_COSTS[projectId] ?? []).find((c) => c.id === committedCostId);
        if (!item) return { error: { status: 404, error: 'COMMITTED_COST_NOT_FOUND' } };
        return { data: item };
      },
      providesTags: (_r, _e, { committedCostId }) => [{ type: 'CommittedCost', id: committedCostId }],
    }),

    // ── Inventory ────────────────────────────────────────────────────────────

    listInventory: build.query<InventoryBalanceDTO[], { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay();
        return { data: MOCK_INVENTORY[projectId] ?? [] };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Inventory', id: projectId }],
    }),

    listInventoryTransactions: build.query<InventoryTransactionDTO[], { orgId: string; projectId: string; materialId: string }>({
      queryFn: async ({ materialId }) => {
        await delay(120);
        return { data: MOCK_INVENTORY_TRANSACTIONS[materialId] ?? [] };
      },
      providesTags: (_r, _e, { materialId }) => [{ type: 'Inventory', id: materialId }],
    }),

    adjustInventory: build.mutation<{ message: string }, { orgId: string; projectId: string; input: AdjustInventoryInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(200);
        const existing = (MOCK_INVENTORY[projectId] ?? []).find(
          (b) => b.materialId === input.materialId && b.location === (input.location ?? 'default')
        );
        const delta = input.direction === 'IN' ? parseFloat(input.quantity) : -parseFloat(input.quantity);
        if (existing) {
          const newBal = parseFloat(existing.balance) + delta;
          if (newBal < 0) return { error: { status: 422, error: 'INSUFFICIENT_INVENTORY' } };
          existing.balance = newBal.toFixed(3);
        } else {
          if (input.direction === 'OUT') return { error: { status: 422, error: 'INSUFFICIENT_INVENTORY' } };
          MOCK_INVENTORY[projectId] = [
            ...(MOCK_INVENTORY[projectId] ?? []),
            { materialId: input.materialId, location: input.location ?? 'default', balance: parseFloat(input.quantity).toFixed(3) },
          ];
        }
        return { data: { message: 'Adjustment recorded' } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Inventory', id: projectId }],
    }),

    // ── Performance (supplier + subcontractor) ────────────────────────────────

    getSupplierPerformance: build.query<{ items: Array<{ id: string; eventType: string; eventTypeLabel: string; recordedAt: string; details: Record<string, unknown> }> }, { orgId: string; projectId: string; supplierId: string }>({
      queryFn: async ({ supplierId }) => {
        await delay(150);
        return { data: { items: [
          { id: `pe_${supplierId}_1`, eventType: 'DELIVERY', eventTypeLabel: 'Delivery on time', recordedAt: '2024-03-15T10:00:00.000Z', details: { poNumber: 'PO-2024-001', daysEarly: 2 } },
          { id: `pe_${supplierId}_2`, eventType: 'DELIVERY', eventTypeLabel: 'Delivery late', recordedAt: '2024-04-20T14:00:00.000Z', details: { poNumber: 'PO-2024-003', daysLate: 3 } },
          { id: `pe_${supplierId}_3`, eventType: 'RECEIPT_REJECTION', eventTypeLabel: 'Receipt rejection', recordedAt: '2024-04-20T15:00:00.000Z', details: { rejectionRate: '2.5%', reason: 'Damaged packaging' } },
        ] } };
      },
      providesTags: ['Performance'],
    }),

    getSubcontractorPerformance: build.query<{ items: Array<{ id: string; eventType: string; eventTypeLabel: string; recordedAt: string; details: Record<string, unknown> }> }, { orgId: string; projectId: string; subcontractorId: string }>({
      queryFn: async ({ subcontractorId }) => {
        await delay(150);
        return { data: { items: [
          { id: `pe_${subcontractorId}_1`, eventType: 'TASK_COMPLETED', eventTypeLabel: 'Task completed', recordedAt: '2024-03-28T16:00:00.000Z', details: { taskName: 'Foundation pour', onTime: true } },
          { id: `pe_${subcontractorId}_2`, eventType: 'TASK_LATE', eventTypeLabel: 'Task late', recordedAt: '2024-06-01T10:00:00.000Z', details: { taskName: 'Superstructure Level 1', daysLate: 14 } },
        ] } };
      },
      providesTags: ['Performance'],
    }),

  }),
});

export const {
  useListMaterialRequestsQuery,
  useGetMaterialRequestQuery,
  useCreateMaterialRequestMutation,
  useUpdateMaterialRequestMutation,
  useSubmitMaterialRequestMutation,
  useCancelMaterialRequestMutation,
  useListQuotesQuery,
  useGetQuoteQuery,
  useCreateQuoteMutation,
  useUpdateQuoteMutation,
  useSubmitQuoteMutation,
  useAcceptQuoteMutation,
  useRejectQuoteMutation,
  useListPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
  useApprovePurchaseOrderMutation,
  useSendPurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  useListApprovalsQuery,
  useGetApprovalQuery,
  useCreateApprovalMutation,
  useApproveApprovalMutation,
  useRejectApprovalMutation,
  useCancelApprovalMutation,
  useListDeliveriesQuery,
  useGetDeliveryQuery,
  useCreateDeliveryMutation,
  useUpdateDeliveryMutation,
  useListReceiptsQuery,
  useCreateReceiptMutation,
  usePostReceiptMutation,
  useVoidReceiptMutation,
  useListCommittedCostsQuery,
  useGetCommittedCostQuery,
  useListInventoryQuery,
  useListInventoryTransactionsQuery,
  useAdjustInventoryMutation,
  useGetSupplierPerformanceQuery,
  useGetSubcontractorPerformanceQuery,
} = procurementApi;
