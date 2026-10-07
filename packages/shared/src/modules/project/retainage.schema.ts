import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const money = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/);

export const retainageParamsSchema = z.object({
  organizationId: id,
  projectId: id,
  retainageId: id.optional(),
  paymentApplicationId: id.optional(),
});

export const releaseRetainageSchema = z.object({
  expectedVersion: z.number().int().positive(),
  amount: money,
  reason: z.string().trim().min(1).max(500),
});

export const listRetainageQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['HELD', 'PARTIALLY_RELEASED', 'RELEASED']).optional(),
});

export type ReleaseRetainageInput = z.infer<typeof releaseRetainageSchema>;
export type ListRetainageQuery = z.infer<typeof listRetainageQuerySchema>;
