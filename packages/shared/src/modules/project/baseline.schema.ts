// packages/shared/src/modules/project/baseline.schema.ts
import { z } from 'zod';

export const createBaselineSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export type CreateBaselineInput = z.infer<typeof createBaselineSchema>;
