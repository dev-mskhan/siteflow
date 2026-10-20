/**
 * taskApi — full RTK Query slice for tasks, baselines, calendar,
 * dependencies and schedule metrics.
 * Backend source:
 *   tasks:        apps/server/src/modules/project/task/task.handler.ts
 *   baselines:    apps/server/src/modules/project/baseline/baseline.handler.ts
 *   calendar:     apps/server/src/modules/project/calendar/calendar.handler.ts
 *   dependencies: apps/server/src/modules/project/dependency/dependency.handler.ts
 *   metrics:      apps/server/src/modules/project/schedule-metrics/schedule-metrics.handler.ts
 * Validation: packages/shared/src/modules/project/task.schema.ts
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  TaskDTO,
  CreateTaskInput,
  UpdateTaskInput,
  TransitionTaskInput,
  ListTasksQuery,
  BaselineDTO,
  BaselineComparisonDTO,
  CreateBaselineInput,
  CalendarDTO,
  UpdateCalendarInput,
  AddCalendarExceptionInput,
  DependencyDTO,
  CreateDependencyInput,
  ScheduleMetricsDTO,
} from '../types/taskTypes';
import {
  MOCK_TASKS,
  MOCK_BASELINES,
  MOCK_BASELINE_COMPARISONS,
  MOCK_CALENDARS,
  MOCK_DEPENDENCIES,
  MOCK_SCHEDULE_METRICS,
} from '../fixtures/task.fixtures';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

// Valid status transitions — mirrors task.service.ts VALID_STATUS_TRANSITIONS
const VALID_TRANSITIONS: Record<string, string[]> = {
  NOT_STARTED: ['READY', 'IN_PROGRESS', 'CANCELLED'],
  READY:       ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELLED'],
  BLOCKED:     ['IN_PROGRESS', 'READY', 'CANCELLED'],
  COMPLETED:   ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED:   ['NOT_STARTED'],
};

export const taskApi = createApi({
  reducerPath: 'taskApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Task', 'Baseline', 'Calendar', 'Dependency', 'ScheduleMetrics', 'ScheduleHistory'],
  endpoints: (build) => ({

    // ── Tasks ──────────────────────────────────────────────────────────────

    listTasks: build.query<{ tasks: TaskDTO[]; totalCount: number }, { orgId: string; projectId: string; query?: ListTasksQuery }>({
      queryFn: async ({ projectId, query }) => {
        await delay();
        let tasks = MOCK_TASKS[projectId] ?? [];
        if (query?.status)   tasks = tasks.filter((t) => t.status === query.status);
        if (query?.taskType) tasks = tasks.filter((t) => t.taskType === query.taskType);
        if (query?.phaseId)  tasks = tasks.filter((t) => t.phaseId === query.phaseId);
        if (query?.assignedTo) tasks = tasks.filter((t) => t.assignedTo === query.assignedTo);
        if (query?.isCritical !== undefined) tasks = tasks.filter((t) => t.isCritical === query.isCritical);
        if (query?.search)   tasks = tasks.filter((t) => t.name.toLowerCase().includes(query.search!.toLowerCase()) || t.taskCode.toLowerCase().includes(query.search!.toLowerCase()));
        if (query?.parentTaskId !== undefined) tasks = tasks.filter((t) => t.parentTaskId === query.parentTaskId);
        return { data: { tasks, totalCount: tasks.length } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Task', id: projectId }],
    }),

    getTask: build.query<TaskDTO, { orgId: string; projectId: string; taskId: string }>({
      queryFn: async ({ projectId, taskId }) => {
        await delay(120);
        const task = (MOCK_TASKS[projectId] ?? []).find((t) => t.id === taskId);
        if (!task) return { error: { status: 404, error: 'TASK_NOT_FOUND' } };
        return { data: task };
      },
      providesTags: (_r, _e, { taskId }) => [{ type: 'Task', id: taskId }],
    }),

    createTask: build.mutation<TaskDTO, { orgId: string; projectId: string; input: CreateTaskInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(200);
        const existing = MOCK_TASKS[projectId] ?? [];
        // Auto-generate taskCode
        const taskCode = input.taskCode ?? `T-${String(existing.length + 1).padStart(3, '0')}`;
        if (existing.some((t) => t.taskCode === taskCode)) {
          return { error: { status: 409, error: 'TASK_CODE_CONFLICT' } };
        }
        // parentTaskId must be a SUMMARY type
        if (input.parentTaskId) {
          const parent = existing.find((t) => t.id === input.parentTaskId);
          if (parent && parent.taskType !== 'SUMMARY') {
            return { error: { status: 422, error: 'INVALID_TASK_TYPE_OPERATION' } };
          }
        }
        const now = new Date().toISOString();
        const newTask: TaskDTO = {
          id: `task_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          phaseId: input.phaseId ?? null,
          parentTaskId: input.parentTaskId ?? null,
          taskCode,
          name: input.name,
          description: input.description ?? null,
          taskType: input.taskType ?? 'TASK',
          status: 'NOT_STARTED',
          priority: input.priority ?? 'NORMAL',
          constraintType: input.constraintType ?? 'ASAP',
          constraintDate: input.constraintDate ?? null,
          assignedTo: input.assignedTo ?? null,
          subcontractorId: input.subcontractorId ?? null,
          currentStartDate: input.currentStartDate ?? null,
          currentFinishDate: input.currentFinishDate ?? null,
          currentDurationDays: input.currentDurationDays ?? (input.taskType === 'MILESTONE' ? 0 : 1),
          progressPercent: input.progressPercent ?? 0,
          actualStartDate: null,
          actualFinishDate: null,
          isCritical: false,
          position: existing.length + 1,
          version: 1,
          createdBy: 'usr_01',
          createdAt: now,
          updatedAt: now,
        };
        MOCK_TASKS[projectId] = [...existing, newTask];
        return { data: newTask };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Task', id: projectId }],
    }),

    updateTask: build.mutation<TaskDTO, { orgId: string; projectId: string; taskId: string; input: UpdateTaskInput }>({
      queryFn: async ({ projectId, taskId, input }) => {
        await delay(180);
        const tasks = MOCK_TASKS[projectId] ?? [];
        const idx = tasks.findIndex((t) => t.id === taskId);
        if (idx === -1) return { error: { status: 404, error: 'TASK_NOT_FOUND' } };
        const task = tasks[idx]!;
        // Optimistic lock
        if (input.expectedVersion !== task.version) {
          return { error: { status: 409, error: 'TASK_VERSION_CONFLICT' } };
        }
        // SUMMARY cannot have dates/duration/progress set directly
        if (task.taskType === 'SUMMARY') {
          if (input.currentStartDate !== undefined || input.currentFinishDate !== undefined ||
              input.currentDurationDays !== undefined || input.progressPercent !== undefined) {
            return { error: { status: 422, error: 'INVALID_TASK_TYPE_OPERATION' } };
          }
        }
        const updated: TaskDTO = {
          ...task,
          name: input.name ?? task.name,
          description: input.description !== undefined ? input.description : task.description,
          phaseId: input.phaseId !== undefined ? input.phaseId : task.phaseId,
          parentTaskId: input.parentTaskId !== undefined ? input.parentTaskId : task.parentTaskId,
          priority: input.priority ?? task.priority,
          constraintType: input.constraintType ?? task.constraintType,
          constraintDate: input.constraintDate !== undefined ? input.constraintDate : task.constraintDate,
          assignedTo: input.assignedTo !== undefined ? input.assignedTo : task.assignedTo,
          subcontractorId: input.subcontractorId !== undefined ? input.subcontractorId : task.subcontractorId,
          currentStartDate: input.currentStartDate !== undefined ? input.currentStartDate : task.currentStartDate,
          currentFinishDate: input.currentFinishDate !== undefined ? input.currentFinishDate : task.currentFinishDate,
          currentDurationDays: input.currentDurationDays ?? task.currentDurationDays,
          progressPercent: input.progressPercent ?? task.progressPercent,
          version: task.version + 1,
          updatedAt: new Date().toISOString(),
        };
        MOCK_TASKS[projectId] = tasks.map((t) => t.id === taskId ? updated : t);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, taskId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: projectId },
      ],
    }),

    transitionTask: build.mutation<TaskDTO, { orgId: string; projectId: string; taskId: string; input: TransitionTaskInput }>({
      queryFn: async ({ projectId, taskId, input }) => {
        await delay(150);
        const tasks = MOCK_TASKS[projectId] ?? [];
        const idx = tasks.findIndex((t) => t.id === taskId);
        if (idx === -1) return { error: { status: 404, error: 'TASK_NOT_FOUND' } };
        const task = tasks[idx]!;
        if (input.expectedVersion !== task.version) {
          return { error: { status: 409, error: 'TASK_VERSION_CONFLICT' } };
        }
        if (task.taskType === 'SUMMARY') {
          return { error: { status: 422, error: 'INVALID_TASK_TYPE_OPERATION' } };
        }
        const allowed = VALID_TRANSITIONS[task.status] ?? [];
        if (!allowed.includes(input.status)) {
          return { error: { status: 422, error: 'INVALID_TASK_TRANSITION' } };
        }
        const today = new Date().toISOString().split('T')[0]!;
        const updated: TaskDTO = {
          ...task,
          status: input.status,
          actualStartDate: input.status === 'IN_PROGRESS' && !task.actualStartDate ? today : task.actualStartDate,
          actualFinishDate: input.status === 'COMPLETED' ? today : task.actualFinishDate,
          progressPercent: input.status === 'COMPLETED' ? 100 : task.progressPercent,
          version: task.version + 1,
          updatedAt: new Date().toISOString(),
        };
        MOCK_TASKS[projectId] = tasks.map((t) => t.id === taskId ? updated : t);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, taskId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: projectId },
      ],
    }),

    deleteTask: build.mutation<void, { orgId: string; projectId: string; taskId: string; expectedVersion: number }>({
      queryFn: async ({ projectId, taskId, expectedVersion }) => {
        await delay(150);
        const tasks = MOCK_TASKS[projectId] ?? [];
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return { error: { status: 404, error: 'TASK_NOT_FOUND' } };
        if (task.version !== expectedVersion) return { error: { status: 409, error: 'TASK_VERSION_CONFLICT' } };
        const children = tasks.filter((t) => t.parentTaskId === taskId);
        if (children.length > 0) return { error: { status: 422, error: 'TASK_DELETION_FORBIDDEN' } };
        // Soft delete — set status CANCELLED
        MOCK_TASKS[projectId] = tasks.map((t) => t.id === taskId ? { ...t, status: 'CANCELLED' as const, version: t.version + 1 } : t);
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Task', id: projectId }],
    }),

    // ── Baselines ──────────────────────────────────────────────────────────

    listBaselines: build.query<BaselineDTO[], { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay();
        return { data: MOCK_BASELINES[projectId] ?? [] };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Baseline', id: projectId }],
    }),

    getBaseline: build.query<BaselineDTO, { orgId: string; projectId: string; baselineId: string }>({
      queryFn: async ({ projectId, baselineId }) => {
        await delay(120);
        const bl = (MOCK_BASELINES[projectId] ?? []).find((b) => b.id === baselineId);
        if (!bl) return { error: { status: 404, error: 'BASELINE_NOT_FOUND' } };
        return { data: bl };
      },
      providesTags: (_r, _e, { baselineId }) => [{ type: 'Baseline', id: baselineId }],
    }),

    createBaseline: build.mutation<BaselineDTO, { orgId: string; projectId: string; input: CreateBaselineInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(250);
        const now = new Date().toISOString();
        const newBl: BaselineDTO = {
          id: `bl_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          name: input.name,
          description: input.description ?? null,
          isActive: false,
          snapshotTaskCount: (MOCK_TASKS[projectId] ?? []).filter((t) => t.status !== 'CANCELLED').length,
          createdBy: 'usr_01',
          createdAt: now,
          updatedAt: now,
        };
        MOCK_BASELINES[projectId] = [...(MOCK_BASELINES[projectId] ?? []), newBl];
        return { data: newBl };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Baseline', id: projectId }],
    }),

    activateBaseline: build.mutation<BaselineDTO, { orgId: string; projectId: string; baselineId: string }>({
      queryFn: async ({ projectId, baselineId }) => {
        await delay(180);
        const bl = (MOCK_BASELINES[projectId] ?? []).find((b) => b.id === baselineId);
        if (!bl) return { error: { status: 404, error: 'BASELINE_NOT_FOUND' } };
        MOCK_BASELINES[projectId] = (MOCK_BASELINES[projectId] ?? []).map((b) => ({ ...b, isActive: b.id === baselineId }));
        return { data: { ...bl, isActive: true } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Baseline', id: projectId }],
    }),

    compareBaseline: build.query<BaselineComparisonDTO, { orgId: string; projectId: string; baselineId: string }>({
      queryFn: async ({ baselineId }) => {
        await delay(200);
        const cmp = MOCK_BASELINE_COMPARISONS[baselineId];
        if (!cmp) return { error: { status: 404, error: 'BASELINE_NOT_FOUND' } };
        return { data: cmp };
      },
      providesTags: (_r, _e, { baselineId }) => [{ type: 'Baseline', id: `cmp:${baselineId}` }],
    }),

    deleteBaseline: build.mutation<void, { orgId: string; projectId: string; baselineId: string }>({
      queryFn: async ({ projectId, baselineId }) => {
        await delay(150);
        MOCK_BASELINES[projectId] = (MOCK_BASELINES[projectId] ?? []).filter((b) => b.id !== baselineId);
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Baseline', id: projectId }],
    }),

    // ── Calendar ───────────────────────────────────────────────────────────

    getCalendar: build.query<CalendarDTO, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay(120);
        const cal = MOCK_CALENDARS[projectId];
        if (!cal) return { data: { id: `cal_${projectId}`, projectId, workingDays: [1,2,3,4,5], workStartTime: '08:00', workEndTime: '17:00', exceptions: [], updatedAt: new Date().toISOString() } };
        return { data: cal };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Calendar', id: projectId }],
    }),

    updateCalendar: build.mutation<CalendarDTO, { orgId: string; projectId: string; input: UpdateCalendarInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(180);
        const cal = MOCK_CALENDARS[projectId] ?? { id: `cal_${projectId}`, projectId, workingDays: [1,2,3,4,5], workStartTime: '08:00', workEndTime: '17:00', exceptions: [], updatedAt: new Date().toISOString() };
        const updated = { ...cal, ...input, updatedAt: new Date().toISOString() };
        MOCK_CALENDARS[projectId] = updated;
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Calendar', id: projectId }],
    }),

    addCalendarException: build.mutation<CalendarDTO, { orgId: string; projectId: string; input: AddCalendarExceptionInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(150);
        const cal = MOCK_CALENDARS[projectId];
        if (!cal) return { error: { status: 404, error: 'CALENDAR_NOT_FOUND' } };
        const newEx = { id: `exc_${Date.now()}`, ...input, description: input.description ?? null };
        const updated = { ...cal, exceptions: [...cal.exceptions, newEx], updatedAt: new Date().toISOString() };
        MOCK_CALENDARS[projectId] = updated;
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Calendar', id: projectId }],
    }),

    removeCalendarException: build.mutation<CalendarDTO, { orgId: string; projectId: string; exceptionId: string }>({
      queryFn: async ({ projectId, exceptionId }) => {
        await delay(150);
        const cal = MOCK_CALENDARS[projectId];
        if (!cal) return { error: { status: 404, error: 'CALENDAR_NOT_FOUND' } };
        const updated = { ...cal, exceptions: cal.exceptions.filter((e) => e.id !== exceptionId), updatedAt: new Date().toISOString() };
        MOCK_CALENDARS[projectId] = updated;
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Calendar', id: projectId }],
    }),

    // ── Dependencies ───────────────────────────────────────────────────────

    listDependencies: build.query<DependencyDTO[], { orgId: string; projectId: string; taskId?: string }>({
      queryFn: async ({ projectId, taskId }) => {
        await delay(120);
        let deps = MOCK_DEPENDENCIES[projectId] ?? [];
        if (taskId) deps = deps.filter((d) => d.predecessorTaskId === taskId || d.successorTaskId === taskId);
        return { data: deps };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Dependency', id: projectId }],
    }),

    createDependency: build.mutation<DependencyDTO, { orgId: string; projectId: string; input: CreateDependencyInput }>({
      queryFn: async ({ projectId, input }) => {
        await delay(180);
        // Cannot link task to itself
        if (input.predecessorTaskId === input.successorTaskId) {
          return { error: { status: 422, error: 'DEPENDENCY_CIRCULAR' } };
        }
        const newDep: DependencyDTO = {
          id: `dep_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          predecessorTaskId: input.predecessorTaskId,
          successorTaskId: input.successorTaskId,
          dependencyType: input.dependencyType ?? 'FS',
          lagDays: input.lagDays ?? 0,
          createdAt: new Date().toISOString(),
        };
        MOCK_DEPENDENCIES[projectId] = [...(MOCK_DEPENDENCIES[projectId] ?? []), newDep];
        return { data: newDep };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Dependency', id: projectId }],
    }),

    deleteDependency: build.mutation<void, { orgId: string; projectId: string; dependencyId: string }>({
      queryFn: async ({ projectId, dependencyId }) => {
        await delay(150);
        MOCK_DEPENDENCIES[projectId] = (MOCK_DEPENDENCIES[projectId] ?? []).filter((d) => d.id !== dependencyId);
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Dependency', id: projectId }],
    }),

    // ── Schedule Metrics ───────────────────────────────────────────────────

    getScheduleMetrics: build.query<ScheduleMetricsDTO, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay(120);
        const metrics = MOCK_SCHEDULE_METRICS[projectId];
        if (!metrics) return { error: { status: 404, error: 'METRICS_NOT_FOUND' } };
        return { data: metrics };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'ScheduleMetrics', id: projectId }],
    }),

    // ── Schedule recalculate (fire-and-forget) ─────────────────────────────

    recalculateSchedule: build.mutation<{ message: string }, { orgId: string; projectId: string }>({
      queryFn: async () => {
        await delay(600);
        return { data: { message: 'Schedule recalculated successfully' } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: 'Task', id: projectId },
        { type: 'ScheduleMetrics', id: projectId },
      ],
    }),

    // ── Schedule History ───────────────────────────────────────────────────

    listScheduleHistory: build.query<{ items: Array<{ id: string; taskId: string; taskName: string; field: string; oldValue: string | null; newValue: string | null; changedBy: string; changedAt: string; reason: string | null }> }, { orgId: string; projectId: string; taskId?: string }>({
      queryFn: async ({ projectId, taskId }) => {
        await delay(150);
        const mock: Array<{ id: string; taskId: string; taskName: string; field: string; oldValue: string | null; newValue: string | null; changedBy: string; changedAt: string; reason: string | null }> = [
          { id: 'sh_01', taskId: 'task_01', taskName: 'Site mobilisation', field: 'currentStartDate', oldValue: '2024-01-20', newValue: '2024-01-20', changedBy: 'Tariq Mehmood', changedAt: '2024-01-15T09:00:00.000Z', reason: 'Initial scheduling' },
          { id: 'sh_02', taskId: 'task_05', taskName: 'Superstructure Level 1', field: 'currentFinishDate', oldValue: '2024-06-30', newValue: '2024-07-14', changedBy: 'Tariq Mehmood', changedAt: '2024-06-01T10:00:00.000Z', reason: 'Weather delay — 14 days variance' },
          { id: 'sh_03', taskId: 'task_08', taskName: 'MEP Rough-in', field: 'currentStartDate', oldValue: '2024-07-01', newValue: '2024-07-15', changedBy: 'Tariq Mehmood', changedAt: '2024-06-28T14:00:00.000Z', reason: 'Dependency shift from superstructure' },
        ];
        let items = mock;
        if (taskId) items = items.filter((e) => e.taskId === taskId);
        return { data: { items } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'ScheduleHistory', id: projectId }],
    }),

  }),
});

export const {
  useListTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useTransitionTaskMutation,
  useDeleteTaskMutation,
  useListBaselinesQuery,
  useGetBaselineQuery,
  useCreateBaselineMutation,
  useActivateBaselineMutation,
  useCompareBaselineQuery,
  useDeleteBaselineMutation,
  useGetCalendarQuery,
  useUpdateCalendarMutation,
  useAddCalendarExceptionMutation,
  useRemoveCalendarExceptionMutation,
  useListDependenciesQuery,
  useCreateDependencyMutation,
  useDeleteDependencyMutation,
  useGetScheduleMetricsQuery,
  useRecalculateScheduleMutation,
  useListScheduleHistoryQuery,
} = taskApi;
