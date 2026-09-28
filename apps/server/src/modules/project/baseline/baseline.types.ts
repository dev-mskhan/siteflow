// apps/server/src/modules/project/baseline/baseline.types.ts
import type { BaselineStatus } from '@siteflow/database/schema';

export interface BaselineDTO {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  status: BaselineStatus;
  activatedAt: string | null; // ISO timestamp
  activatedBy: string | null;
  createdBy: string | null;
  createdAt: string; // ISO timestamp
  taskCount?: number;
  tasks?: BaselineTaskDTO[];
}

export interface BaselineTaskDTO {
  id: string;
  baselineId: string;
  taskId: string;
  baselineStartDate: string;
  baselineFinishDate: string;
  baselineDurationDays: number;
}

export interface CreateBaselineInput {
  name: string;
  description?: string;
}

export interface BaselineComparisonDTO {
  taskId: string;
  taskCode: string;
  taskName: string;
  currentStart: string | null;
  currentFinish: string | null;
  baselineStart: string;
  baselineFinish: string;
  baselineDurationDays: number;
  currentDurationDays: number;
  startVarianceDays: number; // working days variance
  finishVarianceDays: number; // working days variance
}
