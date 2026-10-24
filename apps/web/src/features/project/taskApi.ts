/**
 * taskApi — Live integration for tasks, baselines, calendar, dependencies, and metrics.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Backend: apps/server/src/modules/project/project.routes.ts (embedded task routes)
 * Handlers: apps/server/src/modules/project/task/*.handler.ts
 */
import { baseApi } from '../../services/baseApi';
import type {
  TaskDTO,
  CreateTaskInput,
  UpdateTaskInput,
  TransitionTaskInput,
  ListTasksQuery,
  BaselineDTO,
  CreateBaselineInput,
  CalendarDTO,
  UpdateCalendarInput,
  AddCalendarExceptionInput,
  DependencyDTO,
  CreateDependencyInput,
  ScheduleMetricsDTO,
} from '../../types/taskTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const taskApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Tasks ──────────────────────────────────────────────────────────────

    listTasks: build.query<{ tasks: TaskDTO[]; totalCount: number }, OrgProjectArgs & { query?: ListTasksQuery }>({
      query: ({ orgId, projectId, query }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/tasks`,
        params: query || {},
      }),
      transformResponse: (raw: { data: TaskDTO[]; meta: { totalCount: number } }) => ({
        tasks: raw.data,
        totalCount: raw.meta.totalCount,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Task', id: projectId }],
    }),

    getTask: build.query<TaskDTO, OrgProjectArgs & { taskId: string }>({
      query: ({ orgId, projectId, taskId }) => `/organizations/${orgId}/projects/${projectId}/tasks/${taskId}`,
      transformResponse: (raw: { data: TaskDTO }) => raw.data,
      providesTags: (_r, _e, { taskId }) => [{ type: 'Task', id: taskId }],
    }),

    createTask: build.mutation<TaskDTO, OrgProjectArgs & { input: CreateTaskInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/tasks`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: TaskDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Task', id: projectId }],
    }),

    updateTask: build.mutation<TaskDTO, OrgProjectArgs & { taskId: string; input: UpdateTaskInput }>({
      query: ({ orgId, projectId, taskId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/tasks/${taskId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: TaskDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, taskId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: projectId },
      ],
    }),

    transitionTask: build.mutation<TaskDTO, OrgProjectArgs & { taskId: string; input: TransitionTaskInput }>({
      query: ({ orgId, projectId, taskId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/tasks/${taskId}/transition`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: TaskDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, taskId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: projectId },
      ],
    }),

    deleteTask: build.mutation<void, OrgProjectArgs & { taskId: string; expectedVersion: number }>({
      query: ({ orgId, projectId, taskId, expectedVersion }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/tasks/${taskId}`,
        method: 'DELETE',
        body: { expectedVersion },
      }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Task', id: projectId }],
    }),

    // ── Baselines ──────────────────────────────────────────────────────────

    listBaselines: build.query<BaselineDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/baselines`,
      transformResponse: (raw: { data: BaselineDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Baseline', id: projectId }],
    }),

    getBaseline: build.query<BaselineDTO, OrgProjectArgs & { baselineId: string }>({
      query: ({ orgId, projectId, baselineId }) =>
        `/organizations/${orgId}/projects/${projectId}/baselines/${baselineId}`,
      transformResponse: (raw: { data: BaselineDTO }) => raw.data,
      providesTags: (_r, _e, { baselineId }) => [{ type: 'Baseline', id: baselineId }],
    }),

    createBaseline: build.mutation<BaselineDTO, OrgProjectArgs & { input: CreateBaselineInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: BaselineDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Baseline', id: projectId }],
    }),

    activateBaseline: build.mutation<BaselineDTO, OrgProjectArgs & { baselineId: string }>({
      query: ({ orgId, projectId, baselineId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines/${baselineId}/activate`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: BaselineDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Baseline', id: projectId }],
    }),

    deleteBaseline: build.mutation<void, OrgProjectArgs & { baselineId: string }>({
      query: ({ orgId, projectId, baselineId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines/${baselineId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Baseline', id: projectId }],
    }),

    // ── Calendar ───────────────────────────────────────────────────────────

    getCalendar: build.query<CalendarDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/calendar`,
      transformResponse: (raw: { data: CalendarDTO }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Calendar', id: projectId }],
    }),

    updateCalendar: build.mutation<CalendarDTO, OrgProjectArgs & { input: UpdateCalendarInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/calendar`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: CalendarDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Calendar', id: projectId }],
    }),

    addCalendarException: build.mutation<CalendarDTO, OrgProjectArgs & { input: AddCalendarExceptionInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/calendar/exceptions`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: CalendarDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Calendar', id: projectId }],
    }),

    removeCalendarException: build.mutation<CalendarDTO, OrgProjectArgs & { exceptionId: string }>({
      query: ({ orgId, projectId, exceptionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/calendar/exceptions/${exceptionId}`,
        method: 'DELETE',
      }),
      transformResponse: (raw: { data: CalendarDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Calendar', id: projectId }],
    }),

    // ── Dependencies ───────────────────────────────────────────────────────

    listDependencies: build.query<DependencyDTO[], OrgProjectArgs & { taskId?: string }>({
      query: ({ orgId, projectId, taskId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/dependencies`,
        params: taskId ? { taskId } : {},
      }),
      transformResponse: (raw: { data: DependencyDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Dependency', id: projectId }],
    }),

    createDependency: build.mutation<DependencyDTO, OrgProjectArgs & { input: CreateDependencyInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/dependencies`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: DependencyDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Dependency', id: projectId }],
    }),

    deleteDependency: build.mutation<void, OrgProjectArgs & { dependencyId: string }>({
      query: ({ orgId, projectId, dependencyId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/dependencies/${dependencyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Dependency', id: projectId }],
    }),

    // ── Schedule Metrics ───────────────────────────────────────────────────

    getScheduleMetrics: build.query<ScheduleMetricsDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/schedule/metrics`,
      transformResponse: (raw: { data: ScheduleMetricsDTO }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'ScheduleMetrics', id: projectId }],
    }),

    recalculateSchedule: build.mutation<{ message: string }, OrgProjectArgs>({
      query: ({ orgId, projectId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/schedule/recalculate`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: { message: string } }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: 'Task', id: projectId },
        { type: 'ScheduleMetrics', id: projectId },
      ],
    }),

  }),
  overrideExisting: false,
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
} = taskApi;
