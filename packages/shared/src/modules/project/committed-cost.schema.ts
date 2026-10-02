// packages/shared/src/modules/project/committed-cost.schema.ts
import { z } from 'zod';

export const COMMITTED_COST_STATUSES = ['ACTIVE', 'RELEASED', 'CANCELLED'] as const;

export const listCommittedCostsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(COMMITTED_COST_STATUSES).optional(),
});

export type ListCommittedCostsQuery = z.infer<typeof listCommittedCostsQuerySchema>;
