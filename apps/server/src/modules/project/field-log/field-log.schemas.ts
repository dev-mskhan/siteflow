// apps/server/src/modules/project/field-log/field-log.schemas.ts
import { z } from 'zod';

const entrySchema = z.object({
  taskId: z.string().min(1),
  completionPctRecorded: z.number().int().min(0).max(100),
  quantityCompleted: z.number().positive().optional(),
  unit: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export const createFieldLogSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'logDate must be YYYY-MM-DD'),
  notes: z.string().max(4000).optional(),
  entries: z.array(entrySchema).optional(),
});

export const updateFieldLogSchema = z.object({
  notes: z.string().max(4000).optional(),
  entries: z.array(entrySchema).optional(),
});
