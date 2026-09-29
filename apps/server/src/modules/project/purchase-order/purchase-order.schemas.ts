import { z } from 'zod';

const poItemSchema = z.object({
  materialId: z.string().min(1),
  description: z.string().trim().max(500).optional(),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .refine((v) => parseFloat(v) > 0, { message: 'quantity must be > 0' }),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  materialRequestItemId: z.string().optional(),
  sourceQuoteItemId: z.string().optional(),
  taskId: z.string().optional(),
  phaseId: z.string().optional(),
  costCodeId: z.string().optional(),
  boqLineId: z.string().optional(),
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  materialRequestId: z.string().optional(),
  sourceQuoteId: z.string().optional(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deliveryLocation: z.string().trim().max(500).optional(),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  notes: z.string().trim().max(4000).optional(),
  items: z.array(poItemSchema).min(1),
});

export const updatePurchaseOrderSchema = z.object({
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  deliveryLocation: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const listPurchaseOrdersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z
    .enum([
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'SENT',
      'ACKNOWLEDGED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CANCELLED',
      'CLOSED',
    ])
    .optional(),
});
