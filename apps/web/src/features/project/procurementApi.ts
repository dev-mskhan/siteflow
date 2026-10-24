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
  CommittedCostDTO,
  CreateMaterialRequestInput,
  CreatePurchaseOrderInput,
  CreateReceiptInput,
  AdjustInventoryInput,
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
      }),
      transformResponse: (raw: { data: MaterialRequestDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'MaterialRequest', id: projectId }],
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

    // ── Receipts ───────────────────────────────────────────────────────────

    listReceipts: build.query<ReceiptDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/receipts`,
      transformResponse: (raw: { data: ReceiptDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Receipt', id: projectId }],
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
      ],
    }),

    // ── Inventory ──────────────────────────────────────────────────────────

    listInventory: build.query<InventoryBalanceDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/inventory`,
      transformResponse: (raw: { data: InventoryBalanceDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Inventory', id: projectId }],
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

    // ── Committed Costs ────────────────────────────────────────────────────

    listCommittedCosts: build.query<CommittedCostDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/committed-costs`,
      transformResponse: (raw: { data: CommittedCostDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'CommittedCost', id: projectId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListMaterialRequestsQuery,
  useGetMaterialRequestQuery,
  useCreateMaterialRequestMutation,
  useListPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useListReceiptsQuery,
  useCreateReceiptMutation,
  useListInventoryQuery,
  useAdjustInventoryMutation,
  useListCommittedCostsQuery,
} = procurementApi;
