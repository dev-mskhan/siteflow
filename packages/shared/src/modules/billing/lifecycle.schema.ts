import { z } from 'zod';

export const cancelSubscriptionResponseSchema = z.object({
  subscriptionId: z.string().uuid(),
  cancelAtPeriodEnd: z.literal(true),
  currentPeriodEnd: z.string().nullable(),
  accessUntil: z.string().nullable(),
  idempotent: z.boolean(),
});

export type CancelSubscriptionResponse = z.infer<typeof cancelSubscriptionResponseSchema>;
