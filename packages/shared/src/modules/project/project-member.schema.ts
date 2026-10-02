// packages/shared/src/modules/project/project-member.schema.ts
import { z } from 'zod';

export const PROJECT_ROLES = [
  'PROJECT_MANAGER',
  'SITE_SUPERVISOR',
  'PROJECT_MEMBER',
  'FINANCE',
  'PROCUREMENT',
  'SUBCONTRACTOR',
  'CLIENT',
] as const;

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: z.enum(PROJECT_ROLES),
});

export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(PROJECT_ROLES),
});

export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberRoleInput = z.infer<typeof updateProjectMemberRoleSchema>;
