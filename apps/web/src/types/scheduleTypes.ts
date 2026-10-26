// apps/web/src/types/scheduleTypes.ts

export const DEPENDENCY_TYPES = ['FS', 'SS', 'FF', 'SF'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export interface Dependency {
  id: string;
  projectId: string;
  taskId: string;
  predecessorId: string;
  dependencyType: DependencyType;
  lagDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDependencyInput {
  taskId: string;
  predecessorId: string;
  dependencyType?: DependencyType;
  lagDays?: number;
}

export interface ListDependenciesQuery {
  taskId?: string;
}

// ── Baseline Types ──────────────────────────────────────────────────────

export interface Baseline {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isActive: boolean;
  snapshotDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBaselineInput {
  name: string;
  description?: string;
}

export interface BaselineComparison {
  baselineId: string;
  baselineName: string;
  totalTasks: number;
  changes: {
    added: number;
    removed: number;
    modified: number;
  };
  scheduleVariance: {
    earlyTasks: number;
    lateTasks: number;
    averageDaysVariance: number;
  };
  tasks?: Array<{
    taskId: string;
    taskName: string;
    changeType: 'ADDED' | 'REMOVED' | 'MODIFIED';
    baselineStart?: string;
    currentStart?: string;
    baselineFinish?: string;
    currentFinish?: string;
    varianceDays?: number;
  }>;
}

// ── Calendar Types ──────────────────────────────────────────────────────

export interface WorkDaysConfig {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface CalendarException {
  id: string;
  projectId: string;
  exceptionDate: string;
  isWorkingDay: boolean;
  name: string;
  createdAt: string;
}

export interface Calendar {
  id: string;
  projectId: string;
  name: string;
  timezone: string;
  workDays: WorkDaysConfig;
  hoursPerDay: number;
  exceptions: CalendarException[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCalendarInput {
  name?: string;
  timezone?: string;
  workDays?: WorkDaysConfig;
  hoursPerDay?: number;
}

export interface AddCalendarExceptionInput {
  exceptionDate: string;
  isWorkingDay: boolean;
  name: string;
}

// ── Schedule Operations Types ───────────────────────────────────────────

export interface RecalculateScheduleResult {
  success: boolean;
  queued: boolean;
  revision?: number;
  message: string;
  calculatedAt?: string;
}

export interface ScheduleMetrics {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  criticalPathTasks: number;
  totalSlack: number;
  schedulePerformanceIndex?: number;
  earliestStart?: string;
  latestFinish?: string;
  currentRevision: number;
  lastCalculatedAt?: string;
}

export interface ScheduleHistoryEntry {
  id: string;
  projectId: string;
  taskId?: string;
  revision: number;
  changeType: 'RECALCULATED' | 'TASK_UPDATED' | 'DEPENDENCY_CHANGED' | 'BASELINE_CREATED';
  changedBy: string;
  changedAt: string;
  changes?: Record<string, unknown>;
  description?: string;
}
