// packages/shared/src/modules/billing/checkout.schema.ts
// Phase 10 — SaaS Billing Checkout Request Contracts

import { z } from 'zod';
import { BillingIntervalSchema, PlanIdSchema } from './catalog.schema.js';

export const CheckoutParamsSchema = z.object({
  organizationId: z.string().uuid(),
});
export type CheckoutParams = z.infer<typeof CheckoutParamsSchema>;

export const CheckoutBodySchema = z.object({
  planId: PlanIdSchema,
  interval: BillingIntervalSchema,
}).strict();
export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;
