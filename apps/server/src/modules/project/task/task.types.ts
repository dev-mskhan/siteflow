// apps/server/src/modules/project/task/task.types.ts
import type { TaskType, TaskStatus, TaskPriority, ConstraintType } from '@siteflow/database/schema';

export interface TaskDTO {
  id: string;
  organizationId: string;
  projectId: string;
  phaseId: string | null;
  parentTaskId: string | null;
  taskCode: string;
  externalReference: string | null;
  name: string;
  description: string | null;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  constraintType: ConstraintType;
  constraintDate: string | null;
  assignedTo: string | null;
  subcontractorId: string | null;
  currentStartDate: string | null;
  currentFinishDate: string | null;
  currentDurationDays: number;
  actualStartDate: string | null;
  actualFinishDate: string | null;
  floatDays: number | null;
  isCritical: boolean;
  progressPercent: number;
  position: number;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  taskCode?: string;
  name: string;
  description?: string;
  taskType?: TaskType;
  phaseId?: string;
  parentTaskId?: string;
  priority?: TaskPriority;
  constraintType?: ConstraintType;
  constraintDate?: string;
  assignedTo?: string;
  subcontractorId?: string;
  currentStartDate?: string;
  currentFinishDate?: string;
  currentDurationDays?: number;
  progressPercent?: number;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string | null;
  phaseId?: string | null;
  parentTaskId?: string | null;
  priority?: TaskPriority;
  constraintType?: ConstraintType;
  constraintDate?: string | null;
  assignedTo?: string | null;
  subcontractorId?: string | null;
  currentStartDate?: string | null;
  currentFinishDate?: string | null;
  currentDurationDays?: number;
  progressPercent?: number;
  expectedVersion: number;
}

export interface TaskStatusTransitionInput {
  status: TaskStatus;
  expectedVersion: number;
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  taskType?: TaskType;
  phaseId?: string;
  parentTaskId?: string | null;
  assignedTo?: string;
  isCritical?: boolean;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface TaskListDTO {
  items: TaskDTO[];
  nextCursor: string | null;
  totalCount: number;
}
