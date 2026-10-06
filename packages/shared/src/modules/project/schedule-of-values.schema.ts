import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const money = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/);
const percent = z.string().regex(/^\d{1,3}(?:\.\d{1,2})?$/);

const line = z.object({
  description: z.string().trim().min(1).max(1000),
  costCodeId: id,
  phaseId: id.optional(),
  boqLineId: id.optional(),
  scheduledValue: money,
  retainagePercent: percent.default('0.00'),
});

export const createScheduleOfValuesSchema = z.object({
  contractValue: money,
  currencyCode: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  lines: z.array(line).min(1).max(200),
});

export const updateScheduleOfValuesSchema = createScheduleOfValuesSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const scheduleOfValuesParamsSchema = z.object({
  organizationId: id,
  projectId: id,
  scheduleOfValuesId: id.optional(),
});

export const scheduleOfValuesTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const listScheduleOfValuesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateScheduleOfValuesInput = z.infer<typeof createScheduleOfValuesSchema>;
export type UpdateScheduleOfValuesInput = z.infer<typeof updateScheduleOfValuesSchema>;
