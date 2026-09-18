// apps/server/src/modules/membership/membership.validation.ts
import { z } from 'zod';

export const updateMemberSchema = z.object({
  roleId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});
