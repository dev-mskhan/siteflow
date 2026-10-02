// packages/shared/src/modules/project/field-log.schema.ts
import { z } from 'zod';

export const fieldLogEntrySchema = z.object({
  taskId: z.string().min(1),
  completionPctRecorded: z.number().int().min(0).max(100),
  quantityCompleted: z.number().positive().optional(),
  unit: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export const createFieldLogSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'logDate must be YYYY-MM-DD'),
  notes: z.string().max(4000).optional(),
  entries: z.array(fieldLogEntrySchema).optional(),
});

export const updateFieldLogSchema = z.object({
  notes: z.string().max(4000).optional(),
  entries: z.array(fieldLogEntrySchema).optional(),
});

export const createAmendmentSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required').max(2000),
  correction: z.record(z.unknown()).refine(
    (v) => Object.keys(v).length > 0,
    { message: 'correction must contain at least one field' },
  ),
});

export type FieldLogEntryInput = z.infer<typeof fieldLogEntrySchema>;
export type CreateFieldLogInput = z.infer<typeof createFieldLogSchema>;
export type UpdateFieldLogInput = z.infer<typeof updateFieldLogSchema>;
export type CreateAmendmentInput = z.infer<typeof createAmendmentSchema>;
