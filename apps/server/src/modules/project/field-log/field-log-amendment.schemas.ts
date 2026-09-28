// apps/server/src/modules/project/field-log/field-log-amendment.schemas.ts
import { z } from 'zod';

export const createAmendmentSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required').max(2000),
  correction: z.record(z.unknown()).refine(
    (v) => Object.keys(v).length > 0,
    { message: 'correction must contain at least one field' },
  ),
});
