/**
 * procurementApi — Live integration for procurement modules.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Modules: Material Requests, Purchase Orders, Receipts, Inventory
 */
import { baseApi } from '../../services/baseApi';
import type {
  MaterialRequestDTO,
  PurchaseOrderDTO,
  ReceiptDTO,
  InventoryBalanceDTO,
  InventoryTransactionDTO,
  CommittedCostDTO,
  QuoteDTO,
  ProcurementApprovalDTO,
  DeliveryDTO,
  CreateMaterialRequestInput,
  UpdateMaterialRequestInput,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  CreateReceiptInput,
  AdjustInventoryInput,
  TransferInventoryInput,
  CreateQuoteInput,
  UpdateQuoteInput,
  CreateApprovalInput,
  ReviewApprovalInput,
  CreateDeliveryInput,
  UpdateDeliveryInput,
} from '../../types/procurementTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const procurementApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Material Requests ──────────────────────────────────────────────────

    listMaterialRequests: build.query<MaterialRequestDTO[], OrgProjectArgs & { status?: string }>({
      query: ({ orgId, projectId, status }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/material-requests${query}`;
      },
      transformResponse: (raw: { data: MaterialRequestDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'MaterialRequest', id: projectId }],
    }),

    getMaterialRequest: build.query<MaterialRequestDTO, OrgProjectArgs & { mrId: string }>({
      query: ({ orgId, projectId, mrId }) =>
        `/organizations/${orgId}/projects/${projectId}/material-requests/${mrId}`,
      transformResponse: (raw: { data: MaterialRequestDTO }) => raw.data,
      providesTags: (_r, _e, { mrId }) => [{ type: 'MaterialRequest', id: mrId }],
    }),

    createMaterialRequest: build.mutation<MaterialRequestDTO, OrgProjectArgs & { input: CreateMaterialRequestInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/material-requests`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: MaterialRequestDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'MaterialRequest', id: projectId }],
    }),

    updateMaterialRequest: build.mutation<MaterialRequestDTO, OrgProjectArgs & { mrId: string; input: UpdateMaterialRequestInput }>({
      query: ({ orgId, projectId, mrId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/material-requests/${mrId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: MaterialRequestDTO }) => raw.data,
      invalidatesTags: (_r, _e, { mrId, projectId }) => [
        { type: 'MaterialRequest', id: mrId },
        { type: 'MaterialRequest', id: projectId },
      ],
    }),

    submitMaterialRequest: build.mutation<MaterialRequestDTO, OrgProjectArgs & { mrId: string }>({
      query: ({ orgId, projectId, mrId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/material-requests/${mrId}/submit`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: MaterialRequestDTO }) => raw.data,
      invalidatesTags: (_r, _e, { mrId, projectId }) => [
        { type: 'MaterialRequest', id: mrId },
        { type: 'MaterialRequest', id: projectId },
      ],
    }),

    cancelMaterialRequest: build.mutation<MaterialRequestDTO, OrgProjectArgs & { mrId: string }>({
      query: ({ orgId, projectId, mrId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/material-requests/${mrId}/cancel`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: MaterialRequestDTO }) => raw.data,
      invalidatesTags: (_r, _e, { mrId, projectId }) => [
        { type: 'MaterialRequest', id: mrId },
        { type: 'MaterialRequest', id: projectId },
      ],
    }),

    // ── Purchase Orders ────────────────────────────────────────────────────

    listPurchaseOrders: build.query<PurchaseOrderDTO[], OrgProjectArgs & { status?: string }>({
      query: ({ orgId, projectId, status }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/purchase-orders${query}`;
      },
      transformResponse: (raw: { data: PurchaseOrderDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'PurchaseOrder', id: projectId }],
    }),

    getPurchaseOrder: build.query<PurchaseOrderDTO, OrgProjectArgs & { poId: string }>({
      query: ({ orgId, projectId, poId }) =>
        `/organizations/${orgId}/projects/${projectId}/purchase-orders/${poId}`,
      transformResponse: (raw: { data: PurchaseOrderDTO }) => raw.data,
      providesTags: (_r, _e, { poId }) => [{ type: 'PurchaseOrder', id: poId }],
    }),

    createPurchaseOrder: build.mutation<PurchaseOrderDTO, OrgProjectArgs & { input: CreatePurchaseOrderInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/purchase-orders`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: PurchaseOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'PurchaseOrder', id: projectId }],
    }),

    updatePurchaseOrder: build.mutation<PurchaseOrderDTO, OrgProjectArgs & { poId: string; input: UpdatePurchaseOrderInput }>({
      query: ({ orgId, projectId, poId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/purchase-orders/${poId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: PurchaseOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { poId, projectId }) => [
        { type: 'PurchaseOrder', id: poId },
        { type: 'PurchaseOrder', id: projectId },
      ],
    }),

    submitPurchaseOrder: build.mutation<PurchaseOrderDTO, OrgProjectArgs & { poId: string }>({
      query: ({ orgId, projectId, poId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/purchase-orders/${poId}/submit`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: PurchaseOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { poId, projectId }) => [
        { type: 'PurchaseOrder', id: poId },
        { type: 'PurchaseOrder', id: projectId },
      ],
    }),

    approvePurchaseOrder: build.mutation<PurchaseOrderDTO, OrgProjectArgs & { poId: string }>({
      query: ({ orgId, projectId, poId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/purchase-orders/${poId}/approve`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: PurchaseOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { poId, projectId }) => [
        { type: 'PurchaseOrder', id: poId },
        { type: 'PurchaseOrder', id: projectId },
        { type: 'CommittedCost', id: projectId },
      ],
    }),

    sendPurchaseOrder: build.mutation<PurchaseOrderDTO, OrgProjectArgs & { poId: string }>({
      query: ({ orgId, projectId, poId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/purchase-orders/${poId}/send`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: PurchaseOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { poId, projectId }) => [
        { type: 'PurchaseOrder', id: poId },
        { type: 'PurchaseOrder', id: projectId },
      ],
    }),

    cancelPurchaseOrder: build.mutation<PurchaseOrderDTO, OrgProjectArgs & { poId: string }>({
      query: ({ orgId, projectId, poId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/purchase-orders/${poId}/cancel`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: PurchaseOrderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { poId, projectId }) => [
        { type: 'PurchaseOrder', id: poId },
        { type: 'PurchaseOrder', id: projectId },
        { type: 'CommittedCost', id: projectId },
      ],
    }),

    // ── Quotes ─────────────────────────────────────────────────────────────

    listQuotes: build.query<QuoteDTO[], OrgProjectArgs & { status?: string; supplierId?: string }>({
      query: ({ orgId, projectId, status, supplierId }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (supplierId) params.set('supplierId', supplierId);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/quotes${query}`;
      },
      transformResponse: (raw: { data: QuoteDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Quote', id: projectId }],
    }),

    getQuote: build.query<QuoteDTO, OrgProjectArgs & { quoteId: string }>({
      query: ({ orgId, projectId, quoteId }) =>
        `/organizations/${orgId}/projects/${projectId}/quotes/${quoteId}`,
      transformResponse: (raw: { data: QuoteDTO }) => raw.data,
      providesTags: (_r, _e, { quoteId }) => [{ type: 'Quote', id: quoteId }],
    }),

    createQuote: build.mutation<QuoteDTO, OrgProjectArgs & { input: CreateQuoteInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quotes`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: QuoteDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Quote', id: projectId }],
    }),

    updateQuote: build.mutation<QuoteDTO, OrgProjectArgs & { quoteId: string; input: UpdateQuoteInput }>({
      query: ({ orgId, projectId, quoteId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quotes/${quoteId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: QuoteDTO }) => raw.data,
      invalidatesTags: (_r, _e, { quoteId, projectId }) => [
        { type: 'Quote', id: quoteId },
        { type: 'Quote', id: projectId },
      ],
    }),

    submitQuote: build.mutation<QuoteDTO, OrgProjectArgs & { quoteId: string }>({
      query: ({ orgId, projectId, quoteId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quotes/${quoteId}/submit`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: QuoteDTO }) => raw.data,
      invalidatesTags: (_r, _e, { quoteId, projectId }) => [
        { type: 'Quote', id: quoteId },
        { type: 'Quote', id: projectId },
      ],
    }),

    acceptQuote: build.mutation<QuoteDTO, OrgProjectArgs & { quoteId: string }>({
      query: ({ orgId, projectId, quoteId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quotes/${quoteId}/accept`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: QuoteDTO }) => raw.data,
      invalidatesTags: (_r, _e, { quoteId, projectId }) => [
        { type: 'Quote', id: quoteId },
        { type: 'Quote', id: projectId },
      ],
    }),

    rejectQuote: build.mutation<QuoteDTO, OrgProjectArgs & { quoteId: string }>({
      query: ({ orgId, projectId, quoteId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quotes/${quoteId}/reject`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: QuoteDTO }) => raw.data,
      invalidatesTags: (_r, _e, { quoteId, projectId }) => [
        { type: 'Quote', id: quoteId },
        { type: 'Quote', id: projectId },
      ],
    }),

    // ── Procurement Approvals ──────────────────────────────────────────────

    listApprovals: build.query<ProcurementApprovalDTO[], OrgProjectArgs & { status?: string; resourceType?: string }>({
      query: ({ orgId, projectId, status, resourceType }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (resourceType) params.set('resourceType', resourceType);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/procurement-approvals${query}`;
      },
      transformResponse: (raw: { data: ProcurementApprovalDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'ProcurementApproval', id: projectId }],
    }),

    getApproval: build.query<ProcurementApprovalDTO, OrgProjectArgs & { approvalId: string }>({
      query: ({ orgId, projectId, approvalId }) =>
        `/organizations/${orgId}/projects/${projectId}/procurement-approvals/${approvalId}`,
      transformResponse: (raw: { data: ProcurementApprovalDTO }) => raw.data,
      providesTags: (_r, _e, { approvalId }) => [{ type: 'ProcurementApproval', id: approvalId }],
    }),

    createApproval: build.mutation<ProcurementApprovalDTO, OrgProjectArgs & { input: CreateApprovalInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/procurement-approvals`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ProcurementApprovalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ProcurementApproval', id: projectId }],
    }),

    approveApproval: build.mutation<ProcurementApprovalDTO, OrgProjectArgs & { approvalId: string; input?: ReviewApprovalInput }>({
      query: ({ orgId, projectId, approvalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/procurement-approvals/${approvalId}/approve`,
        method: 'POST',
        body: input || {},
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ProcurementApprovalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { approvalId, projectId }) => [
        { type: 'ProcurementApproval', id: approvalId },
        { type: 'ProcurementApproval', id: projectId },
      ],
    }),

    rejectApproval: build.mutation<ProcurementApprovalDTO, OrgProjectArgs & { approvalId: string; input?: ReviewApprovalInput }>({
      query: ({ orgId, projectId, approvalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/procurement-approvals/${approvalId}/reject`,
        method: 'POST',
        body: input || {},
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ProcurementApprovalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { approvalId, projectId }) => [
        { type: 'ProcurementApproval', id: approvalId },
        { type: 'ProcurementApproval', id: projectId },
      ],
    }),

    cancelApproval: build.mutation<ProcurementApprovalDTO, OrgProjectArgs & { approvalId: string }>({
      query: ({ orgId, projectId, approvalId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/procurement-approvals/${approvalId}/cancel`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ProcurementApprovalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { approvalId, projectId }) => [
        { type: 'ProcurementApproval', id: approvalId },
        { type: 'ProcurementApproval', id: projectId },
      ],
    }),

    // ── Deliveries ─────────────────────────────────────────────────────────

    listDeliveries: build.query<DeliveryDTO[], OrgProjectArgs & { purchaseOrderId?: string; status?: string }>({
      query: ({ orgId, projectId, purchaseOrderId, status }) => {
        const params = new URLSearchParams();
        if (purchaseOrderId) params.set('purchaseOrderId', purchaseOrderId);
        if (status) params.set('status', status);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/deliveries${query}`;
      },
      transformResponse: (raw: { data: DeliveryDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Delivery', id: projectId }],
    }),

    getDelivery: build.query<DeliveryDTO, OrgProjectArgs & { deliveryId: string }>({
      query: ({ orgId, projectId, deliveryId }) =>
        `/organizations/${orgId}/projects/${projectId}/deliveries/${deliveryId}`,
      transformResponse: (raw: { data: DeliveryDTO }) => raw.data,
      providesTags: (_r, _e, { deliveryId }) => [{ type: 'Delivery', id: deliveryId }],
    }),

    createDelivery: build.mutation<DeliveryDTO, OrgProjectArgs & { input: CreateDeliveryInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/deliveries`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: DeliveryDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Delivery', id: projectId }],
    }),

    updateDelivery: build.mutation<DeliveryDTO, OrgProjectArgs & { deliveryId: string; input: UpdateDeliveryInput }>({
      query: ({ orgId, projectId, deliveryId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/deliveries/${deliveryId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: DeliveryDTO }) => raw.data,
      invalidatesTags: (_r, _e, { deliveryId, projectId }) => [
        { type: 'Delivery', id: deliveryId },
        { type: 'Delivery', id: projectId },
      ],
    }),

    // ── Receipts ───────────────────────────────────────────────────────────

    listReceipts: build.query<ReceiptDTO[], OrgProjectArgs & { purchaseOrderId?: string }>({
      query: ({ orgId, projectId, purchaseOrderId }) => {
        const params = new URLSearchParams();
        if (purchaseOrderId) params.set('purchaseOrderId', purchaseOrderId);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/receipts${query}`;
      },
      transformResponse: (raw: { data: ReceiptDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Receipt', id: projectId }],
    }),

    getReceipt: build.query<ReceiptDTO, OrgProjectArgs & { receiptId: string }>({
      query: ({ orgId, projectId, receiptId }) =>
        `/organizations/${orgId}/projects/${projectId}/receipts/${receiptId}`,
      transformResponse: (raw: { data: ReceiptDTO }) => raw.data,
      providesTags: (_r, _e, { receiptId }) => [{ type: 'Receipt', id: receiptId }],
    }),

    createReceipt: build.mutation<ReceiptDTO, OrgProjectArgs & { input: CreateReceiptInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/receipts`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ReceiptDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: 'Receipt', id: projectId },
        { type: 'Inventory', id: projectId },
        { type: 'PurchaseOrder', id: projectId },
      ],
    }),

    postReceipt: build.mutation<ReceiptDTO, OrgProjectArgs & { receiptId: string }>({
      query: ({ orgId, projectId, receiptId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/receipts/${receiptId}/post`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ReceiptDTO }) => raw.data,
      invalidatesTags: (_r, _e, { receiptId, projectId }) => [
        { type: 'Receipt', id: receiptId },
        { type: 'Receipt', id: projectId },
        { type: 'Inventory', id: projectId },
      ],
    }),

    voidReceipt: build.mutation<ReceiptDTO, OrgProjectArgs & { receiptId: string }>({
      query: ({ orgId, projectId, receiptId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/receipts/${receiptId}/void`,
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ReceiptDTO }) => raw.data,
      invalidatesTags: (_r, _e, { receiptId, projectId }) => [
        { type: 'Receipt', id: receiptId },
        { type: 'Receipt', id: projectId },
        { type: 'Inventory', id: projectId },
      ],
    }),

    // ── Inventory ──────────────────────────────────────────────────────────

    listInventory: build.query<InventoryBalanceDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/inventory`,
      transformResponse: (raw: { data: InventoryBalanceDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Inventory', id: projectId }],
    }),

    getInventoryBalance: build.query<InventoryBalanceDTO, OrgProjectArgs & { materialId: string }>({
      query: ({ orgId, projectId, materialId }) =>
        `/organizations/${orgId}/projects/${projectId}/inventory/balance/${materialId}`,
      transformResponse: (raw: { data: InventoryBalanceDTO }) => raw.data,
      providesTags: (_r, _e, { materialId }) => [{ type: 'Inventory', id: materialId }],
    }),

    getInventoryTransactions: build.query<InventoryTransactionDTO[], OrgProjectArgs & { materialId: string }>({
      query: ({ orgId, projectId, materialId }) =>
        `/organizations/${orgId}/projects/${projectId}/inventory/transactions/${materialId}`,
      transformResponse: (raw: { data: InventoryTransactionDTO[] }) => raw.data,
      providesTags: (_r, _e, { materialId }) => [{ type: 'Inventory', id: `tx-${materialId}` }],
    }),

    adjustInventory: build.mutation<void, OrgProjectArgs & { input: AdjustInventoryInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/inventory/adjust`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Inventory', id: projectId }],
    }),

    transferInventory: build.mutation<void, OrgProjectArgs & { input: TransferInventoryInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/inventory/transfers`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Inventory', id: projectId }],
    }),

    // ── Committed Costs ────────────────────────────────────────────────────

    listCommittedCosts: build.query<CommittedCostDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/committed-costs`,
      transformResponse: (raw: { data: CommittedCostDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'CommittedCost', id: projectId }],
    }),

    getCommittedCost: build.query<CommittedCostDTO, OrgProjectArgs & { committedCostId: string }>({
      query: ({ orgId, projectId, committedCostId }) =>
        `/organizations/${orgId}/projects/${projectId}/committed-costs/${committedCostId}`,
      transformResponse: (raw: { data: CommittedCostDTO }) => raw.data,
      providesTags: (_r, _e, { committedCostId }) => [{ type: 'CommittedCost', id: committedCostId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  // Material Requests
  useListMaterialRequestsQuery,
  useGetMaterialRequestQuery,
  useCreateMaterialRequestMutation,
  useUpdateMaterialRequestMutation,
  useSubmitMaterialRequestMutation,
  useCancelMaterialRequestMutation,
  // Purchase Orders
  useListPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
  useApprovePurchaseOrderMutation,
  useSendPurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  // Quotes
  useListQuotesQuery,
  useGetQuoteQuery,
  useCreateQuoteMutation,
  useUpdateQuoteMutation,
  useSubmitQuoteMutation,
  useAcceptQuoteMutation,
  useRejectQuoteMutation,
  // Procurement Approvals
  useListApprovalsQuery,
  useGetApprovalQuery,
  useCreateApprovalMutation,
  useApproveApprovalMutation,
  useRejectApprovalMutation,
  useCancelApprovalMutation,
  // Deliveries
  useListDeliveriesQuery,
  useGetDeliveryQuery,
  useCreateDeliveryMutation,
  useUpdateDeliveryMutation,
  // Receipts
  useListReceiptsQuery,
  useGetReceiptQuery,
  useCreateReceiptMutation,
  usePostReceiptMutation,
  useVoidReceiptMutation,
  // Inventory
  useListInventoryQuery,
  useGetInventoryBalanceQuery,
  useGetInventoryTransactionsQuery,
  useAdjustInventoryMutation,
  useTransferInventoryMutation,
  // Committed Costs
  useListCommittedCostsQuery,
  useGetCommittedCostQuery,
} = procurementApi;
