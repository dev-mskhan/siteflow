// packages/shared/src/modules/billing/trial.schema.ts
// Phase 10 — SaaS Billing Shared Trial Contracts

import { z } from 'zod';

export const TrialStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'CONVERTED']);
export type TrialStatus = z.infer<typeof TrialStatusSchema>;

export const TrialDTOSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  tier: z.string(),
  status: TrialStatusSchema,
  startedAt: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrialDTO = z.infer<typeof TrialDTOSchema>;

export const StartTrialResponseSchema = z.object({
  trial: TrialDTOSchema,
});
export type StartTrialResponse = z.infer<typeof StartTrialResponseSchema>;

export const GetTrialStatusResponseSchema = z.object({
  trial: TrialDTOSchema.nullable(),
});
export type GetTrialStatusResponse = z.infer<typeof GetTrialStatusResponseSchema>;
