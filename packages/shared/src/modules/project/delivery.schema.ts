// packages/shared/src/modules/project/delivery.schema.ts
import { z } from 'zod';

const deliveryItemSchema = z.object({
  purchaseOrderItemId: z.string().min(1),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/).refine((v) => parseFloat(v) > 0),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  notes: z.string().trim().max(1000).optional(),
});

export const createDeliverySchema = z.object({
  purchaseOrderId: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  supplierReference: z.string().trim().max(200).optional(),
  carrier: z.string().trim().max(200).optional(),
  trackingReference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
  items: z.array(deliveryItemSchema).min(1),
});

export const updateDeliverySchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  supplierReference: z.string().trim().max(200).optional(),
  carrier: z.string().trim().max(200).optional(),
  trackingReference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
});

const receiptItemSchema = z.object({
  purchaseOrderItemId: z.string().min(1),
  quantityDelivered: z.string().regex(/^\d+(\.\d{1,3})?$/).refine((v) => parseFloat(v) >= 0),
  quantityAccepted: z.string().regex(/^\d+(\.\d{1,3})?$/).refine((v) => parseFloat(v) >= 0),
  quantityRejected: z.string().regex(/^\d+(\.\d{1,3})?$/).optional(),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  rejectionReason: z.string().trim().max(1000).optional(),
  condition: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const createReceiptSchema = z.object({
  purchaseOrderId: z.string().min(1),
  deliveryId: z.string().optional(),
  receivedAt: z.string().datetime(),
  notes: z.string().trim().max(4000).optional(),
  items: z.array(receiptItemSchema).min(1),
});

export const listDeliveryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ListDeliveryQuery = z.infer<typeof listDeliveryQuerySchema>;
