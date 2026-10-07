import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const money = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const line = z.object({
  scheduleOfValueLineId: id,
  currentWork: money,
  storedMaterials: money,
});

export const createPaymentApplicationSchema = z.object({
  billingPeriodStart: date,
  billingPeriodEnd: date,
  lines: z
    .array(line)
    .min(1)
    .max(200)
    .refine(
      (items) => new Set(items.map((item) => item.scheduleOfValueLineId)).size === items.length,
    ),
});

export const updatePaymentApplicationSchema = createPaymentApplicationSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const paymentApplicationTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const rejectPaymentApplicationSchema = paymentApplicationTransitionSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

export const approvePaymentApplicationSchema = paymentApplicationTransitionSchema.extend({
  lines: z
    .array(
      z.object({
        scheduleOfValueLineId: id,
        approvedCurrentWork: money,
        approvedStoredMaterials: money,
      }),
    )
    .min(1)
    .max(200)
    .refine(
      (items) => new Set(items.map((item) => item.scheduleOfValueLineId)).size === items.length,
    ),
});

export const paymentApplicationParamsSchema = z.object({
  organizationId: id,
  projectId: id,
  paymentApplicationId: id.optional(),
});

export const listPaymentApplicationsQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePaymentApplicationInput = z.infer<typeof createPaymentApplicationSchema>;
export type UpdatePaymentApplicationInput = z.infer<typeof updatePaymentApplicationSchema>;
export type ApprovePaymentApplicationInput = z.infer<typeof approvePaymentApplicationSchema>;
export type ListPaymentApplicationsQuery = z.infer<typeof listPaymentApplicationsQuerySchema>;
