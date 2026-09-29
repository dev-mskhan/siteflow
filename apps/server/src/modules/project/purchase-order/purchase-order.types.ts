export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';

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

export interface POItemInput {
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
  boqLineId?: string;
  expectedDeliveryDate?: string;
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
  items: POItemInput[];
}

export interface UpdatePurchaseOrderInput {
  expectedDeliveryDate?: string | null;
  deliveryLocation?: string;
  notes?: string;
}

export interface ListPurchaseOrdersQuery {
  cursor?: string;
  limit?: number;
  status?: PurchaseOrderStatus;
}
