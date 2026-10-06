import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const money = z.string().regex(/^-?\d{1,13}(?:\.\d{1,2})?$/);

const line = z.object({
  description: z.string().trim().min(1).max(1000),
  costCodeId: id,
  phaseId: id.optional(),
  taskId: id.optional(),
  documentId: id.optional(),
  boqLineId: id.optional(),
  costDelta: money.default('0.00'),
  revenueDelta: money.default('0.00'),
});

export const createChangeOrderSchema = z.object({
  title: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(2000),
  currencyCode: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  scheduleDeltaDays: z.number().int().min(-36500).max(36500).default(0),
  clientApprovalRequired: z.boolean().default(false),
  lines: z.array(line).min(1).max(200),
});

export const updateChangeOrderSchema = createChangeOrderSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const changeOrderParamsSchema = z.object({
  organizationId: id,
  projectId: id,
  changeOrderId: id.optional(),
});

export const listChangeOrdersQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'PENDING_CLIENT_APPROVAL',
    'CLIENT_APPROVED',
    'REJECTED',
    'EFFECTED',
    'VOIDED',
  ]).optional(),
});

export const changeOrderTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const rejectChangeOrderSchema = changeOrderTransitionSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

export type CreateChangeOrderInput = z.infer<typeof createChangeOrderSchema>;
export type UpdateChangeOrderInput = z.infer<typeof updateChangeOrderSchema>;
export type ListChangeOrdersQuery = z.infer<typeof listChangeOrdersQuerySchema>;
