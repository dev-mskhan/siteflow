// apps/server/src/modules/project/members/project-member.schemas.ts
import { z } from 'zod';

const PROJECT_ROLES = [
  'PROJECT_MANAGER',
  'SITE_SUPERVISOR',
  'PROJECT_MEMBER',
  'FINANCE',
  'PROCUREMENT',
  'SUBCONTRACTOR',
  'CLIENT',
] as const;

export const addMemberSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: z.enum(PROJECT_ROLES),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(PROJECT_ROLES),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
