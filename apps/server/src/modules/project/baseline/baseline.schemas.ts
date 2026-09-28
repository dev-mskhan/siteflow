// apps/server/src/modules/project/baseline/baseline.schemas.ts
import { z } from 'zod';

export const createBaselineSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export type CreateBaselineBody = z.infer<typeof createBaselineSchema>;
