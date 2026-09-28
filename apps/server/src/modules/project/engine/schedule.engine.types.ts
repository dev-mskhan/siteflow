// apps/server/src/modules/project/engine/schedule.engine.types.ts
import type { ConstraintType, DependencyType, TaskType } from '@siteflow/database/schema';

export interface ScheduleNode {
  id: string;
  taskCode: string;
  taskType: TaskType;
  durationDays: number;
  currentStartDate: string | null; // ISO YYYY-MM-DD
  currentFinishDate: string | null; // ISO YYYY-MM-DD
  constraintType: ConstraintType;
  constraintDate: string | null; // ISO YYYY-MM-DD

  // Calculated scheduling metrics
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  totalFloat?: number;
  freeFloat?: number;
  isCritical?: boolean;
}

export interface ScheduleDependency {
  id: string;
  taskId: string; // successor
  predecessorId: string;
  dependencyType: DependencyType;
  lagDays: number;
}

export interface ScheduleGraph {
  nodes: Map<string, ScheduleNode>; // taskId -> node
  edges: ScheduleDependency[];
  projectStartDate: string; // ISO YYYY-MM-DD
}

export interface ScheduleValidationResult {
  valid: boolean;
  errors: {
    code: string;
    message: string;
    taskId?: string;
  }[];
}

export interface ScheduleCalculationResult {
  updatedNodes: Map<string, ScheduleNode>;
  maxFinishDate: string | null;
  criticalPathTaskIds: string[];
}
