// Full TaskDTO — mirrors apps/server/src/modules/project/task/task.types.ts
// Shared enums from packages/shared/src/modules/project/task.schema.ts

export type TaskType     = 'TASK' | 'MILESTONE' | 'SUMMARY';
export type TaskStatus   = 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type ConstraintType = 'ASAP' | 'START_NO_EARLIER_THAN' | 'FINISH_NO_LATER_THAN';

export interface TaskDTO {
  id: string;
  organizationId: string;
  projectId: string;
  phaseId: string | null;
  parentTaskId: string | null;
  taskCode: string;
  name: string;
  description: string | null;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  constraintType: ConstraintType;
  constraintDate: string | null;
  assignedTo: string | null;       // userId
  subcontractorId: string | null;
  currentStartDate: string | null; // YYYY-MM-DD
  currentFinishDate: string | null;
  currentDurationDays: number;
  progressPercent: number;         // 0-100
  actualStartDate: string | null;
  actualFinishDate: string | null;
  isCritical: boolean;
  position: number;
  version: number;                 // optimistic lock
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  name: string;
  taskCode?: string;
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

export interface TransitionTaskInput {
  status: TaskStatus;
  expectedVersion: number;
}

export interface ListTasksQuery {
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

// ── Baseline ──────────────────────────────────────────────────────────────────

export interface BaselineDTO {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  snapshotTaskCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BaselineComparisonDTO {
  baselineId: string;
  baselineName: string;
  tasks: Array<{
    taskId: string;
    taskCode: string;
    name: string;
    baselineStart: string | null;
    baselineFinish: string | null;
    currentStart: string | null;
    currentFinish: string | null;
    startVarianceDays: number | null;
    finishVarianceDays: number | null;
    status: TaskStatus;
  }>;
}

export interface CreateBaselineInput {
  name: string;
  description?: string;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export interface CalendarDTO {
  id: string;
  projectId: string;
  workingDays: number[];           // 0=Sun 1=Mon ... 6=Sat
  workStartTime: string | null;    // HH:MM
  workEndTime: string | null;
  exceptions: CalendarExceptionDTO[];
  updatedAt: string;
}

export interface CalendarExceptionDTO {
  id: string;
  date: string;                    // YYYY-MM-DD
  exceptionType: 'WORKING_DAY' | 'NON_WORKING_DAY';
  description: string | null;
}

export interface UpdateCalendarInput {
  workingDays?: number[];
  workStartTime?: string | null;
  workEndTime?: string | null;
}

export interface AddCalendarExceptionInput {
  date: string;
  exceptionType: 'WORKING_DAY' | 'NON_WORKING_DAY';
  description?: string;
}

// ── Dependency ────────────────────────────────────────────────────────────────

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface DependencyDTO {
  id: string;
  organizationId: string;
  projectId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: DependencyType;
  lagDays: number;
  createdAt: string;
}

export interface CreateDependencyInput {
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType?: DependencyType;
  lagDays?: number;
}

// ── Schedule Metrics ──────────────────────────────────────────────────────────

export interface ScheduleMetricsDTO {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  criticalPathTasks: number;
  progressPercent: number;
  schedulePerformanceIndex: number | null;
  plannedValue: number | null;
  earnedValue: number | null;
  scheduleVarianceDays: number | null;
  calculatedAt: string;
}
