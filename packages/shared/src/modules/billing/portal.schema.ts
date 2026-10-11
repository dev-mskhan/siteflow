// packages/shared/src/modules/billing/portal.schema.ts
// Phase 10 — SaaS Billing Customer Portal Request Contracts

import { z } from 'zod';

export const PortalParamsSchema = z.object({
  organizationId: z.string().uuid(),
}).strict();
export type PortalParams = z.infer<typeof PortalParamsSchema>;
