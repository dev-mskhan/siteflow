import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const unitCode = z.string().trim().min(1).max(32);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const unitPrice = z.string().regex(/^\d{1,11}(?:\.\d{1,4})?$/);
const rateScope = z.enum(['ORGANIZATION', 'PROJECT']);

export const materialRateVersionCreateSchema = z
  .object({
    materialId: id,
    scope: rateScope,
    projectId: id.nullable().optional(),
    unitCode,
    unitPrice,
    currencyCode,
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scope === 'PROJECT' && value.projectId == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['projectId'],
        message: 'Project rate versions require a projectId.',
      });
    }
    if (value.scope === 'ORGANIZATION' && value.projectId != null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['projectId'],
        message: 'Organization rate versions must not set a projectId.',
      });
    }
    if (value.effectiveTo != null && value.effectiveTo <= value.effectiveFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveTo'],
        message: 'effectiveTo must be after effectiveFrom.',
      });
    }
  });

export const materialRateVersionRetireSchema = z
  .object({
    effectiveTo: isoDate,
  })
  .strict();

export const materialRateResolveQuerySchema = z
  .object({
    materialId: id,
    projectId: id.optional(),
    asOf: isoDate,
  })
  .strict();

export type MaterialRateVersionCreateInput = z.infer<typeof materialRateVersionCreateSchema>;
export type MaterialRateVersionRetireInput = z.infer<typeof materialRateVersionRetireSchema>;
export type MaterialRateResolveQuery = z.infer<typeof materialRateResolveQuerySchema>;
