import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const nullableText = (max = 5000) => z.string().trim().max(max).nullable().optional();

export const createRfiSchema = z.object({
  title: z.string().trim().min(1).max(500),
  question: z.string().trim().min(1).max(20000),
  discipline: nullableText(255),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  recipientName: nullableText(255),
  dueDate: dateSchema.nullable().optional(),
  scheduleImpactDays: z.number().int().min(-36500).max(36500).optional(),
  costImpact: z.number().finite().min(-9999999999999.99).max(9999999999999.99).nullable().optional(),
  linkedTaskId: z.string().min(1).max(128).nullable().optional(),
  notes: nullableText(),
});

export const updateRfiSchema = createRfiSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const submitRfiSchema = z.object({});
export const respondRfiSchema = z.object({
  response: z.string().trim().min(1).max(20000),
  scheduleImpactDays: z.number().int().min(-36500).max(36500).optional(),
  costImpact: z.number().finite().min(-9999999999999.99).max(9999999999999.99).nullable().optional(),
});

export const listRfisQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['DRAFT', 'OPEN', 'UNDER_REVIEW', 'ANSWERED', 'CLOSED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

export type CreateRfiInput = z.infer<typeof createRfiSchema>;
export type UpdateRfiInput = z.infer<typeof updateRfiSchema>;
export type RespondRfiInput = z.infer<typeof respondRfiSchema>;
export type ListRfisQuery = z.infer<typeof listRfisQuerySchema>;
