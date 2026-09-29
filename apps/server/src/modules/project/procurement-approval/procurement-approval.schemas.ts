import { z } from 'zod';

export const createApprovalSchema = z.object({
  resourceType: z.enum(['MATERIAL_REQUEST', 'QUOTE', 'PURCHASE_ORDER']),
  resourceId: z.string().min(1),
});

export const reviewApprovalSchema = z.object({
  decisionReason: z.string().trim().max(2000).optional(),
});

export const listApprovalsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});
