// packages/shared/src/modules/project/quote.schema.ts
import { z } from 'zod';

export const QUOTE_STATUSES = ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;

const quoteItemSchema = z.object({
  materialRequestItemId: z.string().optional(),
  materialId: z.string().min(1),
  description: z.string().trim().max(500).optional(),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/).refine((v) => parseFloat(v) > 0),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const createQuoteSchema = z.object({
  supplierId: z.string().min(1),
  materialRequestId: z.string().optional(),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  notes: z.string().trim().max(4000).optional(),
  items: z.array(quoteItemSchema).min(1),
});

export const updateQuoteSchema = z.object({
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().trim().max(4000).optional(),
});

export const listQuotesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(QUOTE_STATUSES).optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type ListQuotesQuery = z.infer<typeof listQuotesQuerySchema>;
