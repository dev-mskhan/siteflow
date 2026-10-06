import { z } from 'zod';

const money = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/);
const quantity = z.string().regex(/^\d{1,12}(?:\.\d{1,3})?$/);
const id = z.string().trim().min(1).max(128);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });

export const createCostTransactionSchema = z
  .object({
    costCodeId: id,
    phaseId: id.optional(),
    taskId: id.optional(),
    documentId: id.optional(),
    sourceType: z.enum(['MANUAL', 'DOCUMENT', 'TASK', 'PHASE']).default('MANUAL'),
    sourceId: id.optional(),
    transactionDate: isoDate,
    description: z.string().trim().min(1).max(1000),
    quantity: quantity.optional(),
    unit: z.string().trim().min(1).max(64).optional(),
    unitCost: money.optional(),
    subtotal: money.optional(),
    taxAmount: money.default('0.00'),
    currencyCode: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  })
  .superRefine((value, context) => {
    const hasQuantity = value.quantity !== undefined;
    const hasUnit = value.unit !== undefined;
    const hasUnitCost = value.unitCost !== undefined;
    if (hasQuantity || hasUnit || hasUnitCost) {
      if (!(hasQuantity && hasUnit && hasUnitCost)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quantity, unit, and unit cost must be provided together.',
          path: ['quantity'],
        });
      }
    }
    if (value.subtotal === undefined && !(hasQuantity && hasUnitCost)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide subtotal or quantity with unit and unit cost.',
        path: ['subtotal'],
      });
    }
    if (value.sourceType === 'MANUAL' && value.sourceId !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Manual transactions cannot reference an external source.',
        path: ['sourceId'],
      });
    }
    if (value.sourceType !== 'MANUAL' && value.sourceId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A source ID is required for this source type.',
        path: ['sourceId'],
      });
    }
  });

export const costTransactionParamsSchema = z.object({
  organizationId: id,
  projectId: id,
  transactionId: id.optional(),
});

export const listCostTransactionsQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'POSTED', 'VOIDED']).optional(),
  costCodeId: id.optional(),
});

export const costTransactionTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const voidCostTransactionSchema = costTransactionTransitionSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

export type CreateCostTransactionInput = z.infer<typeof createCostTransactionSchema>;
export type ListCostTransactionsQuery = z.infer<typeof listCostTransactionsQuerySchema>;
