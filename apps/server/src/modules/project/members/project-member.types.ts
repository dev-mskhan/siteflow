// apps/server/src/modules/project/members/project-member.types.ts
import type { ProjectRole } from '../core/project.types.js';

export type { ProjectRole };

export type ProjectMemberStatus = 'ACTIVE' | 'REMOVED';

export interface ProjectMembership {
  id: string;
  projectId: string;
  organizationId: string;
  userId: string;
  role: ProjectRole;
  status: ProjectMemberStatus;
  addedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMemberWithUser extends ProjectMembership {
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  };
}

export interface ProjectMemberDTO {
  id: string;
  userId: string;
  role: ProjectRole;
  status: ProjectMemberStatus;
  addedBy: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  };
}

export interface AddMemberInput {
  userId: string;
  role: ProjectRole;
}

export interface UpdateMemberRoleInput {
  role: ProjectRole;
}
