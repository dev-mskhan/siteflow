// packages/shared/src/modules/membership/membership.schema.ts
import { z } from 'zod';

export const updateMemberSchema = z.object({
  roleId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
