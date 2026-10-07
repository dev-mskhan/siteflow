import { z } from 'zod';

const id = z.string().trim().min(1).max(128);

export const financialSummaryParamsSchema = z.object({
  organizationId: id,
  projectId: id,
  changeOrderId: id.optional(),
});

export const financialAuditQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().min(1).max(128).optional(),
  entityType: z.string().trim().min(1).max(128).optional(),
  entityId: id.optional(),
});

export type FinancialAuditQuery = z.infer<typeof financialAuditQuerySchema>;
