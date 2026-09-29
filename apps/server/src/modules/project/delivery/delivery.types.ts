export type DeliveryStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export interface DeliveryItemDTO {
  id: string; organizationId: string; deliveryId: string; purchaseOrderItemId: string;
  quantity: string; unitCode: string; notes: string | null;
}
export interface DeliveryDTO {
  id: string; organizationId: string; projectId: string; purchaseOrderId: string;
  deliveryNumber: string; status: DeliveryStatus;
  scheduledDate: string | null; actualDeliveryDate: string | null;
  supplierReference: string | null; carrier: string | null; trackingReference: string | null;
  notes: string | null; items: DeliveryItemDTO[]; createdAt: string; updatedAt: string;
}
export interface ReceiptItemDTO {
  id: string; organizationId: string; receiptId: string; purchaseOrderItemId: string;
  quantityDelivered: string; quantityAccepted: string; quantityRejected: string;
  unitCode: string; rejectionReason: string | null; condition: string | null; notes: string | null;
}
export interface ReceiptDTO {
  id: string; organizationId: string; projectId: string; purchaseOrderId: string;
  deliveryId: string | null; receiptNumber: string; status: ReceiptStatus;
  receivedAt: string; receivedByMemberId: string | null; notes: string | null;
  items: ReceiptItemDTO[]; createdAt: string;
}
export interface DeliveryItemInput { purchaseOrderItemId: string; quantity: string; unitCode: string; notes?: string; }
export interface CreateDeliveryInput {
  purchaseOrderId: string; scheduledDate?: string; supplierReference?: string;
  carrier?: string; trackingReference?: string; notes?: string; items: DeliveryItemInput[];
}
export interface UpdateDeliveryInput {
  status?: DeliveryStatus; scheduledDate?: string; actualDeliveryDate?: string;
  supplierReference?: string; carrier?: string; trackingReference?: string; notes?: string;
}
export interface ReceiptItemInput {
  purchaseOrderItemId: string; quantityDelivered: string; quantityAccepted: string;
  quantityRejected?: string; unitCode: string; rejectionReason?: string;
  condition?: string; notes?: string;
}
export interface CreateReceiptInput {
  purchaseOrderId: string; deliveryId?: string; receivedAt: string;
  notes?: string; items: ReceiptItemInput[];
}
