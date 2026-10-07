// packages/shared/src/modules/project/cost-code.schema.ts
import { z } from 'zod';

const CODE_REGEX = /^[A-Z0-9-]{1,50}$/;

export const createCostCodeSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(50)
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(CODE_REGEX, 'Code must be uppercase alphanumeric with hyphens only')),
  description: z.string().max(2000).optional(),
});

export const updateCostCodeSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(CODE_REGEX))
    .optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const listCostCodesQuerySchema = z.object({
  includeInactive: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional()
    .default(false),
});

export type CreateCostCodeInput = z.infer<typeof createCostCodeSchema>;
export type UpdateCostCodeInput = z.infer<typeof updateCostCodeSchema>;
