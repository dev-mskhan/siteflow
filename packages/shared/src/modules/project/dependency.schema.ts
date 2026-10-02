// packages/shared/src/modules/project/dependency.schema.ts
import { z } from 'zod';

export const DEPENDENCY_TYPES = ['FS', 'SS', 'FF', 'SF'] as const;

export const createDependencySchema = z.object({
  taskId: z.string().min(1),
  predecessorId: z.string().min(1),
  dependencyType: z.enum(DEPENDENCY_TYPES).optional().default('FS'),
  lagDays: z.number().int().min(-365).max(365).optional().default(0),
});

export const listDependenciesQuerySchema = z.object({
  taskId: z.string().optional(),
});

export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
export type ListDependenciesQuery = z.infer<typeof listDependenciesQuerySchema>;
