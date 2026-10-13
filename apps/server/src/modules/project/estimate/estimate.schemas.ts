import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const title = z.string().trim().min(1).max(160);
const money = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/);
const quantity = z.string().regex(/^\d{1,12}(?:\.\d{1,3})?$/);
const componentQuantity = z.string().regex(/^\d{1,9}(?:\.\d{1,6})?$/);
const percentage = z
  .string()
  .regex(/^(?:100(?:\.0{1,4})?|(?:\d{1,2})(?:\.\d{1,4})?)$/);
const category = z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER']);

const resourceSchema = z
  .object({
    category,
    description: z.string().trim().min(1).max(500),
    unit: z.string().trim().min(1).max(32),
    quantityPerLineUnit: componentQuantity,
    unitRate: money,
    wastePercent: percentage.default('0'),
    rateSource: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

const lineSchema = z
  .object({
    category,
    description: z.string().trim().min(1).max(500),
    specification: z.string().trim().max(2000).nullable().optional(),
    costCodeId: id.nullable().optional(),
    quantity,
    unit: z.string().trim().min(1).max(32),
    unitRate: money.nullable().optional(),
    resources: z.array(resourceSchema).max(10).optional(),
  })
  .strict()
  .refine(
    (line) =>
      (line.unitRate != null && (line.resources?.length ?? 0) === 0) ||
      (line.unitRate == null && (line.resources?.length ?? 0) > 0),
    'Use a direct unit rate or resource components, not both.',
  );

const sectionSchema = z
  .object({
    title,
    description: z.string().trim().max(2000).nullable().optional(),
    lines: z.array(lineSchema).min(1).max(500),
  })
  .strict();

const estimateDraftFields = z
  .object({
    title,
    description: z.string().trim().max(5000).nullable().optional(),
    terms: z
      .object({
        overheadPercent: percentage.default('0'),
        contingencyPercent: percentage.default('0'),
        markupMode: z.enum(['NONE', 'MARKUP', 'TARGET_MARGIN']).default('NONE'),
        markupPercent: percentage.default('0'),
        discountPercent: percentage.default('0'),
        taxPercent: percentage.default('0'),
        taxSource: z.string().trim().max(500).nullable().optional(),
      })
      .strict()
      .superRefine((terms, context) => {
        if (terms.markupMode === 'TARGET_MARGIN' && Number(terms.markupPercent) >= 100) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['markupPercent'],
            message: 'Target margin must be less than 100%.',
          });
        }
        if (Number(terms.taxPercent) > 0 && !terms.taxSource?.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['taxSource'],
            message: 'Provide the tax basis/source when tax is applied.',
          });
        }
      }),
    sections: z.array(sectionSchema).min(1).max(50),
  })
  .strict();

const enforceLineLimit = (
  input: { sections: { lines: unknown[] }[] },
  context: z.RefinementCtx,
) => {
  const lineCount = input.sections.reduce((count, section) => count + section.lines.length, 0);
  if (lineCount > 500) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sections'],
      message: 'An estimate cannot contain more than 500 lines.',
    });
  }
};

export const estimateDraftSchema = estimateDraftFields.superRefine(enforceLineLimit);
export const createEstimateSchema = estimateDraftSchema;
export const updateEstimateSchema = estimateDraftFields
  .extend({ expectedVersion: z.number().int().positive() })
  .strict()
  .superRefine(enforceLineLimit);
export const transitionEstimateSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const rejectEstimateSchema = transitionEstimateSchema.extend({
  reason: z.string().trim().min(10).max(500),
});
export const estimateParamsSchema = z
  .object({
    organizationId: id,
    projectId: id,
    estimateId: id.optional(),
  })
  .strict();
export const estimateListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(256).optional(),
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
  })
  .strict();
export const estimateCompareQuerySchema = z
  .object({
    fromRevision: z.coerce.number().int().positive(),
    toRevision: z.coerce.number().int().positive(),
  })
  .strict()
  .refine((value) => value.fromRevision !== value.toRevision, {
    message: 'Select two different revisions.',
  });

export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;
export type EstimateTransitionInput = z.infer<typeof transitionEstimateSchema>;
export type EstimateRejectInput = z.infer<typeof rejectEstimateSchema>;
