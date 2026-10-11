import { z } from 'zod';

export const saasInvoiceStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'PAID',
  'UNCOLLECTIBLE',
  'VOID',
]);

export const saasPaymentAttemptStatusSchema = z.enum(['FAILED', 'SUCCEEDED']);

export const SAAS_INVOICE_HISTORY_DEFAULT_LIMIT = 20;
export const SAAS_INVOICE_HISTORY_MAX_LIMIT = 100;
export const SAAS_INVOICE_HISTORY_MAX_ATTEMPTS_PER_INVOICE = 100;

export const saasInvoiceHistoryQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SAAS_INVOICE_HISTORY_MAX_LIMIT)
      .default(SAAS_INVOICE_HISTORY_DEFAULT_LIMIT),
  })
  .strict();

export const saasInvoiceHistoryItemSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string().max(255).nullable(),
  status: saasInvoiceStatusSchema,
  amountDueCents: z.number().int().nonnegative(),
  amountPaidCents: z.number().int().nonnegative(),
  currency: z.string().regex(/^[a-z]{3}$/),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  hostedInvoiceUrl: z.string().url().nullable(),
  invoicePdfUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
});

export const saasPaymentAttemptSchema = z.object({
  id: z.string().uuid(),
  status: saasPaymentAttemptStatusSchema,
  amountCents: z.number().int().nonnegative(),
  currency: z.string().regex(/^[a-z]{3}$/),
  attemptedAt: z.string().datetime(),
});

export const saasInvoiceHistoryRecordSchema = saasInvoiceHistoryItemSchema.extend({
  paymentAttempts: z
    .array(saasPaymentAttemptSchema)
    .max(SAAS_INVOICE_HISTORY_MAX_ATTEMPTS_PER_INVOICE),
});

export const saasInvoiceHistoryDataSchema = z.object({
  invoices: z.array(saasInvoiceHistoryRecordSchema).max(SAAS_INVOICE_HISTORY_MAX_LIMIT),
});

export type SaasInvoiceHistoryItem = z.infer<typeof saasInvoiceHistoryItemSchema>;
export type SaasPaymentAttemptDto = z.infer<typeof saasPaymentAttemptSchema>;
export type SaasInvoiceHistoryQuery = z.infer<typeof saasInvoiceHistoryQuerySchema>;
export type SaasInvoiceHistoryRecord = z.infer<typeof saasInvoiceHistoryRecordSchema>;
export type SaasInvoiceHistoryData = z.infer<typeof saasInvoiceHistoryDataSchema>;
