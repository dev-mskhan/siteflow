// apps/server/src/modules/organization/sequences/sequences.validation.ts
import { z } from 'zod';

export const updateSequenceSchema = z.object({
  prefix: z.string().min(1, 'Prefix must be at least 1 character').max(10, 'Prefix must be at most 10 characters').optional(),
  padding: z
    .number()
    .int()
    .min(1, 'Padding must be between 1 and 10')
    .max(10, 'Padding must be between 1 and 10')
    .optional(),
  // nextValue is intentionally excluded — never writable via API
});
