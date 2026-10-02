// packages/shared/src/modules/project/performance.schema.ts
import { z } from 'zod';

export const listPerformanceQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListPerformanceQuery = z.infer<typeof listPerformanceQuerySchema>;
