// apps/server/src/modules/invitation/invitation.validation.ts
import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  roleId: z.string().uuid('Role ID must be a valid UUID'),
  orgName: z.string().optional(),
  inviterName: z.string().optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});
