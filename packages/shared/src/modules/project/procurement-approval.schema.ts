// packages/shared/src/modules/project/procurement-approval.schema.ts
import { z } from 'zod';

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export const APPROVAL_RESOURCE_TYPES = ['MATERIAL_REQUEST', 'QUOTE', 'PURCHASE_ORDER'] as const;

export const createApprovalSchema = z.object({
  resourceType: z.enum(APPROVAL_RESOURCE_TYPES),
  resourceId: z.string().min(1),
});

export const reviewApprovalSchema = z.object({
  decisionReason: z.string().trim().max(2000).optional(),
});

export const listApprovalsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(APPROVAL_STATUSES).optional(),
});

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;
export type ReviewApprovalInput = z.infer<typeof reviewApprovalSchema>;
export type ListApprovalsQuery = z.infer<typeof listApprovalsQuerySchema>;
