// ── Material Request ──────────────────────────────────────────────────────────

export type MaterialRequestStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED'
  | 'PARTIALLY_ORDERED' | 'ORDERED' | 'FULFILLED' | 'CANCELLED' | 'REJECTED';

export type MaterialRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface MaterialRequestItemDTO {
  id: string;
  organizationId: string;
  materialRequestId: string;
  materialId: string;
  description: string | null;
  quantity: string;
  unitCode: string;
  requiredByDate: string | null;
  taskId: string | null;
  phaseId: string | null;
  costCodeId: string | null;
  boqLineId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialRequestDTO {
  id: string;
  organizationId: string;
  projectId: string;
  requestNumber: string;
  requestedByMemberId: string | null;
  status: MaterialRequestStatus;
  requiredByDate: string | null;
  deliveryLocation: string | null;
  priority: MaterialRequestPriority;
  notes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  items: MaterialRequestItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialRequestInput {
  requiredByDate?: string;
  deliveryLocation?: string;
  priority?: MaterialRequestPriority;
  notes?: string;
  items: Array<{
    materialId: string;
    description?: string;
    quantity: string;
    unitCode: string;
    requiredByDate?: string;
    taskId?: string;
    phaseId?: string;
    costCodeId?: string;
    notes?: string;
  }>;
}

export interface UpdateMaterialRequestInput {
  requiredByDate?: string;
  deliveryLocation?: string;
  priority?: MaterialRequestPriority;
  notes?: string;
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export type QuoteStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface QuoteItemDTO {
  id: string;
  organizationId: string;
  quoteId: string;
  materialRequestItemId: string | null;
  materialId: string;
  description: string | null;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
  expectedDeliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDTO {
  id: string;
  organizationId: string;
  projectId: string;
  quoteNumber: string;
  supplierId: string;
  materialRequestId: string | null;
  status: QuoteStatus;
  quoteDate: string;
  validUntil: string | null;
  currencyCode: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  notes: string | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  items: QuoteItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteInput {
  supplierId: string;
  materialRequestId?: string;
  quoteDate: string;
  validUntil?: string;
  currencyCode: string;
  notes?: string;
  items: Array<{
    materialRequestItemId?: string;
    materialId: string;
    description?: string;
    quantity: string;
    unitCode: string;
    unitPrice: string;
    discountAmount?: string;
    taxAmount?: string;
    expectedDeliveryDate?: string;
  }>;
}

export interface UpdateQuoteInput {
  quoteDate?: string;
  validUntil?: string | null;
  notes?: string;
}

// ── Purchase Order ────────────────────────────────────────────────────────────

export type PurchaseOrderStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT'
  | 'ACKNOWLEDGED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED' | 'CLOSED';

export interface PurchaseOrderItemDTO {
  id: string;
  organizationId: string;
  purchaseOrderId: string;
  materialId: string;
  description: string | null;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
  materialRequestItemId: string | null;
  sourceQuoteItemId: string | null;
  taskId: string | null;
  phaseId: string | null;
  costCodeId: string | null;
  boqLineId: string | null;
  expectedDeliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderDTO {
  id: string;
  organizationId: string;
  projectId: string;
  poNumber: string;
  supplierId: string;
  materialRequestId: string | null;
  sourceQuoteId: string | null;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  deliveryLocation: string | null;
  currencyCode: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  notes: string | null;
  createdByMemberId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  items: PurchaseOrderItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  materialRequestId?: string;
  sourceQuoteId?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  deliveryLocation?: string;
  currencyCode: string;
  notes?: string;
  items: Array<{
    materialId: string;
    description?: string;
    quantity: string;
    unitCode: string;
    unitPrice: string;
    discountAmount?: string;
    taxAmount?: string;
    materialRequestItemId?: string;
    sourceQuoteItemId?: string;
    taskId?: string;
    phaseId?: string;
    costCodeId?: string;
    expectedDeliveryDate?: string;
  }>;
}

export interface UpdatePurchaseOrderInput {
  expectedDeliveryDate?: string | null;
  deliveryLocation?: string;
  notes?: string;
}

// ── Procurement Approval ──────────────────────────────────────────────────────

export type ProcurementApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ProcurementApprovalResourceType = 'MATERIAL_REQUEST' | 'QUOTE' | 'PURCHASE_ORDER';

export interface ProcurementApprovalDTO {
  id: string;
  organizationId: string;
  projectId: string;
  resourceType: ProcurementApprovalResourceType;
  resourceId: string;
  status: ProcurementApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApprovalInput {
  resourceType: ProcurementApprovalResourceType;
  resourceId: string;
}

export interface ReviewApprovalInput {
  decisionReason?: string;
}

// ── Delivery & Receipt ────────────────────────────────────────────────────────

export type DeliveryStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export interface DeliveryItemDTO {
  id: string;
  organizationId: string;
  deliveryId: string;
  purchaseOrderItemId: string;
  quantity: string;
  unitCode: string;
  notes: string | null;
}

export interface DeliveryDTO {
  id: string;
  organizationId: string;
  projectId: string;
  purchaseOrderId: string;
  deliveryNumber: string;
  status: DeliveryStatus;
  scheduledDate: string | null;
  actualDeliveryDate: string | null;
  supplierReference: string | null;
  carrier: string | null;
  trackingReference: string | null;
  notes: string | null;
  items: DeliveryItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeliveryInput {
  purchaseOrderId: string;
  scheduledDate?: string;
  supplierReference?: string;
  carrier?: string;
  trackingReference?: string;
  notes?: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: string;
    unitCode: string;
    notes?: string;
  }>;
}

export interface UpdateDeliveryInput {
  status?: DeliveryStatus;
  scheduledDate?: string;
  actualDeliveryDate?: string;
  supplierReference?: string;
  carrier?: string;
  trackingReference?: string;
  notes?: string;
}

export interface ReceiptItemDTO {
  id: string;
  organizationId: string;
  receiptId: string;
  purchaseOrderItemId: string;
  quantityDelivered: string;
  quantityAccepted: string;
  quantityRejected: string;
  unitCode: string;
  rejectionReason: string | null;
  condition: string | null;
  notes: string | null;
}

export interface ReceiptDTO {
  id: string;
  organizationId: string;
  projectId: string;
  purchaseOrderId: string;
  deliveryId: string | null;
  receiptNumber: string;
  status: ReceiptStatus;
  receivedAt: string;
  receivedByMemberId: string | null;
  notes: string | null;
  items: ReceiptItemDTO[];
  createdAt: string;
}

export interface CreateReceiptInput {
  purchaseOrderId: string;
  deliveryId?: string;
  receivedAt: string;
  notes?: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantityDelivered: string;
    quantityAccepted: string;
    quantityRejected?: string;
    unitCode: string;
    rejectionReason?: string;
    condition?: string;
    notes?: string;
  }>;
}

// ── Committed Cost ────────────────────────────────────────────────────────────

export type CommittedCostStatus = 'ACTIVE' | 'RELEASED' | 'CANCELLED';
export type CommitmentLifecycleStatus = 'APPROVED' | 'PARTIALLY_INVOICED' | 'FULLY_INVOICED' | 'CLOSED' | 'CANCELLED';

export interface CommittedCostDTO {
  id: string;
  organizationId: string;
  projectId: string;
  sourceType: 'PURCHASE_ORDER';
  sourceId: string;
  supplierId: string | null;
  purchaseOrderId: string | null;
  costCodeId: string | null;
  taskId: string | null;
  boqLineId: string | null;
  currencyCode: string;
  committedAmount: string;
  status: CommittedCostStatus;
  lifecycleStatus: CommitmentLifecycleStatus;
  purchaseOrderStatus: string | null;
  committedAt: string;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface InventoryBalanceDTO {
  materialId: string;
  location: string;
  balance: string;
}

export interface InventoryTransactionDTO {
  id: string;
  organizationId: string;
  projectId: string;
  inventoryItemId: string;
  materialId: string;
  transactionType: 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  quantity: string;
  unitCode: string;
  sourceType: string;
  sourceId: string;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface AdjustInventoryInput {
  materialId: string;
  location?: string;
  quantity: string;
  unitCode: string;
  direction: 'IN' | 'OUT';
  reason: string;
}

export interface TransferInventoryInput {
  materialId: string;
  quantity: string;
  unitCode: string;
  fromLocation: string;
  toLocation: string;
}
