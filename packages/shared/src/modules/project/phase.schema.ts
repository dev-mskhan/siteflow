// packages/shared/src/modules/project/phase.schema.ts
import { z } from 'zod';

export const createPhaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  startsAt: z.string().date('Expected YYYY-MM-DD').optional(),
  endsAt: z.string().date('Expected YYYY-MM-DD').optional(),
});

export const updatePhaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  startsAt: z.string().date().nullable().optional(),
  endsAt: z.string().date().nullable().optional(),
});

export const reorderPhasesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1, 'orderedIds must not be empty'),
});

export const listPhasesQuerySchema = z.object({
  includeArchived: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional().default(false),
});

export type CreatePhaseInput = z.infer<typeof createPhaseSchema>;
export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>;
export type ReorderPhasesInput = z.infer<typeof reorderPhasesSchema>;
export type ListPhasesQuery = z.infer<typeof listPhasesQuerySchema>;
