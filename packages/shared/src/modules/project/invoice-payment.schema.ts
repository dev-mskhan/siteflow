import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const money = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });

const invoiceFields = {
  invoiceNumber: z.string().trim().min(1).max(128),
  invoiceDate: date,
  dueDate: date.optional(),
  subtotal: money,
  taxAmount: money.default('0.00'),
  retainageAmount: money.default('0.00'),
};

export const createInvoiceSchema = z.discriminatedUnion('direction', [
  z.object({
    direction: z.literal('RECEIVABLE'),
    ...invoiceFields,
    paymentApplicationId: id,
    billToName: z.string().trim().min(1).max(256),
  }),
  z.object({
    direction: z.literal('PAYABLE'),
    ...invoiceFields,
    purchaseOrderId: id,
  }),
]);

export const listInvoicesQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['RECEIVABLE', 'PAYABLE']).optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'VOIDED']).optional(),
});

export const invoiceParamsSchema = z.object({
  organizationId: id,
  projectId: id,
  invoiceId: id.optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.and(
  z.object({ expectedVersion: z.number().int().positive() }),
);

export const invoiceTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const rejectInvoiceSchema = invoiceTransitionSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

export const createPaymentSchema = z.object({
  amount: money,
  paymentDate: date,
  method: z.string().trim().min(1).max(64),
  reference: z.string().trim().max(256).optional(),
});

export const listPaymentsQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  invoiceId: id.optional(),
  status: z
    .enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED', 'VOIDED'])
    .optional(),
});

export const paymentParamsSchema = z.object({
  organizationId: id,
  projectId: id,
  paymentId: id.optional(),
});

export const paymentTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const rejectPaymentSchema = paymentTransitionSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
