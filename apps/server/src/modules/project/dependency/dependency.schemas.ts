// apps/server/src/modules/project/dependency/dependency.schemas.ts
import { z } from 'zod';

export const createDependencySchema = z.object({
  taskId: z.string().min(1),
  predecessorId: z.string().min(1),
  dependencyType: z.enum(['FS', 'SS', 'FF', 'SF']).optional().default('FS'),
  lagDays: z.number().int().min(-365).max(365).optional().default(0),
});

export type CreateDependencyBody = z.infer<typeof createDependencySchema>;
