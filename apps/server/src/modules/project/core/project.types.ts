// apps/server/src/modules/project/core/project.types.ts
import type { ProjectStatus, ProjectType, ProjectRole } from '@siteflow/database/schema';

export type { ProjectStatus, ProjectType, ProjectRole };

// ── State Machine ─────────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export type ProjectTransition = 'activate' | 'hold' | 'resume' | 'complete' | 'cancel' | 'archive';

export const TRANSITION_TO_STATUS: Record<ProjectTransition, ProjectStatus> = {
  activate: 'ACTIVE',
  hold: 'ON_HOLD',
  resume: 'ACTIVE',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
  archive: 'ARCHIVED',
};

// ── Domain Types ──────────────────────────────────────────────────────────────

export interface ProjectDomain {
  id: string;
  organizationId: string;
  projectNumber: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  projectType: ProjectType | null;
  contractValue: string | null;
  currency: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  version: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── DTO Types (API surface — version never exposed on write path) ──────────────

export interface ProjectDTO {
  id: string;
  organizationId: string;
  projectNumber: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  projectType: ProjectType | null;
  contractValue: string | null;
  currency: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListDTO {
  data: ProjectDTO[];
  nextCursor: string | null;
}

// ── Input Types ───────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  description?: string;
  projectType?: ProjectType;
  contractValue?: string;
  currency?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  projectType?: ProjectType | null;
  contractValue?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  expectedVersion: number; // required — optimistic concurrency
}

export interface ListProjectsFilter {
  cursor?: string;
  limit?: number;
  status?: ProjectStatus;
  search?: string;
}

// ── ProjectContext — set by projectContext preHandler ─────────────────────────

export interface ProjectContext {
  organizationId: string;
  projectId: string;
  userId: string;
  organizationMembership: {
    id: string;
    roleId: string;
    permissions: string[];
  };
  projectMembership: ProjectMembershipRef | null;
}

export interface ProjectMembershipRef {
  id: string;
  role: ProjectRole;
  status: 'ACTIVE' | 'REMOVED';
}
