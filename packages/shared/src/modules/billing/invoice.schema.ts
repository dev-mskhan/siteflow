import { z } from 'zod';

export const saasInvoiceStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'PAID',
  'UNCOLLECTIBLE',
  'VOID',
]);

export const saasPaymentAttemptStatusSchema = z.enum(['FAILED', 'SUCCEEDED']);

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

export type SaasInvoiceHistoryItem = z.infer<typeof saasInvoiceHistoryItemSchema>;
export type SaasPaymentAttemptDto = z.infer<typeof saasPaymentAttemptSchema>;
