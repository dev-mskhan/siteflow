import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const title = z.string().trim().min(1).max(160);
const description = z.string().trim().max(2000).nullable().optional();
const unit = z.string().trim().min(1).max(32);
const quantity = z.string().regex(/^\d{1,12}(?:\.\d{1,3})?$/);
const decimalInput = z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/);
const percentage = z
  .string()
  .regex(/^(?:100(?:\.0{1,4})?|(?:\d{1,2})(?:\.\d{1,4})?)$/);
const dimension = z.enum(['LENGTH', 'AREA', 'VOLUME', 'COUNT']);
const measurementMode = z.enum(['MANUAL', 'FORMULA']);
const variableName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,31}$/);
const formulaText = z.string().trim().min(1).max(500);

export const takeoffFormulaInputSchema = z
  .object({
    variableName,
    value: decimalInput,
    unit,
    dimension,
  })
  .strict();

const measurementBase = z
  .object({
    description: z.string().trim().min(1).max(500),
    dimension,
    unit,
    measurementMode,
    sourceId: id.nullable().optional(),
    manualQuantity: quantity.nullable().optional(),
    formulaText: formulaText.nullable().optional(),
    inputs: z.array(takeoffFormulaInputSchema).max(20).default([]),
    deductionQuantity: quantity.default('0'),
    wastePercent: percentage.default('0'),
    boqItemId: id.nullable().optional(),
    costCodeId: id.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

const measurementFields = measurementBase.superRefine((value, context) => {
    if (value.measurementMode === 'MANUAL' && value.manualQuantity == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['manualQuantity'],
        message: 'Manual measurements require a manual quantity.',
      });
    }
    if (value.measurementMode === 'FORMULA' && value.formulaText == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['formulaText'],
        message: 'Formula measurements require formula text.',
      });
    }
    if (value.measurementMode === 'MANUAL' && (value.formulaText != null || value.inputs.length > 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['measurementMode'],
        message: 'Manual measurements cannot include formula text or inputs.',
      });
    }
    if (value.measurementMode === 'FORMULA' && value.manualQuantity != null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['manualQuantity'],
        message: 'Formula measurements cannot include a manual quantity.',
      });
    }
    const names = new Set<string>();
    for (const input of value.inputs) {
      if (names.has(input.variableName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['inputs'],
          message: `Duplicate variable name: ${input.variableName}.`,
        });
        break;
      }
      names.add(input.variableName);
    }
  });

export const createTakeoffSheetSchema = z
  .object({
    title,
    description,
  })
  .strict();

export const updateTakeoffSheetSchema = z
  .object({
    title: title.optional(),
    description,
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const takeoffTransitionSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export const takeoffRejectSchema = takeoffTransitionSchema.extend({
  reason: z.string().trim().min(10).max(500),
});

export const createTakeoffMeasurementSchema = measurementFields;

export const updateTakeoffMeasurementSchema = measurementBase
  .partial()
  .extend({ expectedVersion: z.number().int().positive() })
  .strict();

export const takeoffFormulaPreviewSchema = z
  .object({
    formulaText,
    inputs: z.array(takeoffFormulaInputSchema).max(20).default([]),
    dimension,
    unit,
  })
  .strict();

export const takeoffParamsSchema = z
  .object({
    organizationId: id,
    projectId: id,
    sheetId: id.optional(),
    measurementId: id.optional(),
  })
  .strict();

export const takeoffListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(256).optional(),
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
  })
  .strict();

export const takeoffRevisionQuerySchema = z
  .object({
    revisionNumber: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const takeoffSourceCreateSchema = z
  .object({
    documentId: id,
    documentVersionId: id,
    pageReference: z.string().trim().min(1).max(64),
    regionLabel: z.string().trim().max(160).nullable().optional(),
  })
  .strict();

export const takeoffCompareQuerySchema = z
  .object({
    fromRevision: z.coerce.number().int().positive(),
    toRevision: z.coerce.number().int().positive(),
  })
  .strict()
  .refine((value) => value.fromRevision !== value.toRevision, {
    message: 'Select two different revisions.',
  });

export const takeoffSummaryQuerySchema = z
  .object({
    groupBy: z.enum(['BOQ_ITEM', 'COST_CODE', 'SHEET']).default('SHEET'),
  })
  .strict();

export type CreateTakeoffSheetInput = z.infer<typeof createTakeoffSheetSchema>;
export type UpdateTakeoffSheetInput = z.infer<typeof updateTakeoffSheetSchema>;
export type TakeoffTransitionInput = z.infer<typeof takeoffTransitionSchema>;
export type TakeoffRejectInput = z.infer<typeof takeoffRejectSchema>;
export type CreateTakeoffMeasurementInput = z.infer<typeof createTakeoffMeasurementSchema>;
export type UpdateTakeoffMeasurementInput = z.infer<typeof updateTakeoffMeasurementSchema>;
export type TakeoffFormulaPreviewInput = z.infer<typeof takeoffFormulaPreviewSchema>;
