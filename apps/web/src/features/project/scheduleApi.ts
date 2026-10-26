// apps/web/src/features/project/scheduleApi.ts
import { baseApi } from '../../services/baseApi';
import type {
  Dependency,
  CreateDependencyInput,
  ListDependenciesQuery,
  Baseline,
  CreateBaselineInput,
  BaselineComparison,
  Calendar,
  UpdateCalendarInput,
  AddCalendarExceptionInput,
  RecalculateScheduleResult,
  ScheduleMetrics,
  ScheduleHistoryEntry,
} from '../../types/scheduleTypes';

/**
 * Schedule API - Integrates with backend schedule engine, baselines, calendar, and dependencies.
 * All routes are project-scoped: /organizations/:orgId/projects/:projectId/...
 */
export const scheduleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ────────────────────────────────────────────────────────────────────────
    // Dependencies
    // ────────────────────────────────────────────────────────────────────────

    listDependencies: builder.query<
      Dependency[],
      { orgId: string; projectId: string; query?: ListDependenciesQuery }
    >({
      query: ({ orgId, projectId, query }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/dependencies`,
        method: 'GET',
        params: query,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Dependency[] }) => raw.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Dependency' as const, id })),
              { type: 'Dependency', id: 'LIST' },
            ]
          : [{ type: 'Dependency', id: 'LIST' }],
    }),

    createDependency: builder.mutation<
      Dependency,
      { orgId: string; projectId: string; data: CreateDependencyInput }
    >({
      query: ({ orgId, projectId, data }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/dependencies`,
        method: 'POST',
        body: data,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Dependency }) => raw.data,
      invalidatesTags: [
        { type: 'Dependency', id: 'LIST' },
        { type: 'Task', id: 'LIST' },
        { type: 'ScheduleMetrics', id: 'CURRENT' },
      ],
    }),

    deleteDependency: builder.mutation<
      void,
      { orgId: string; projectId: string; dependencyId: string }
    >({
      query: ({ orgId, projectId, dependencyId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/dependencies/${dependencyId}`,
        method: 'DELETE',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      invalidatesTags: (_result, _error, { dependencyId }) => [
        { type: 'Dependency', id: dependencyId },
        { type: 'Dependency', id: 'LIST' },
        { type: 'Task', id: 'LIST' },
        { type: 'ScheduleMetrics', id: 'CURRENT' },
      ],
    }),

    // ────────────────────────────────────────────────────────────────────────
    // Schedule Operations
    // ────────────────────────────────────────────────────────────────────────

    recalculateSchedule: builder.mutation<
      RecalculateScheduleResult,
      { orgId: string; projectId: string; expectedRevision?: number }
    >({
      query: ({ orgId, projectId, expectedRevision }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/schedule/recalculate`,
        method: 'POST',
        params: expectedRevision ? { expectedRevision } : undefined,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: RecalculateScheduleResult }) => raw.data,
      invalidatesTags: [
        { type: 'ScheduleMetrics', id: 'CURRENT' },
        { type: 'ScheduleHistory', id: 'LIST' },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    getScheduleMetrics: builder.query<
      ScheduleMetrics,
      { orgId: string; projectId: string }
    >({
      query: ({ orgId, projectId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/schedule/metrics`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ScheduleMetrics }) => raw.data,
      providesTags: [{ type: 'ScheduleMetrics', id: 'CURRENT' }],
    }),

    listScheduleHistory: builder.query<
      ScheduleHistoryEntry[],
      { orgId: string; projectId: string; taskId?: string }
    >({
      query: ({ orgId, projectId, taskId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/schedule/history`,
        method: 'GET',
        params: taskId ? { taskId } : undefined,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ScheduleHistoryEntry[] }) => raw.data,
      providesTags: [{ type: 'ScheduleHistory', id: 'LIST' }],
    }),

    // ────────────────────────────────────────────────────────────────────────
    // Baselines
    // ────────────────────────────────────────────────────────────────────────

    listBaselines: builder.query<Baseline[], { orgId: string; projectId: string }>({
      query: ({ orgId, projectId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Baseline[] }) => raw.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Baseline' as const, id })),
              { type: 'Baseline', id: 'LIST' },
            ]
          : [{ type: 'Baseline', id: 'LIST' }],
    }),

    createBaseline: builder.mutation<
      Baseline,
      { orgId: string; projectId: string; data: CreateBaselineInput }
    >({
      query: ({ orgId, projectId, data }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines`,
        method: 'POST',
        body: data,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Baseline }) => raw.data,
      invalidatesTags: [
        { type: 'Baseline', id: 'LIST' },
        { type: 'ScheduleHistory', id: 'LIST' },
      ],
    }),

    getBaseline: builder.query<
      Baseline,
      { orgId: string; projectId: string; baselineId: string }
    >({
      query: ({ orgId, projectId, baselineId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines/${baselineId}`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Baseline }) => raw.data,
      providesTags: (_result, _error, { baselineId }) => [{ type: 'Baseline', id: baselineId }],
    }),

    activateBaseline: builder.mutation<
      Baseline,
      { orgId: string; projectId: string; baselineId: string }
    >({
      query: ({ orgId, projectId, baselineId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines/${baselineId}/activate`,
        method: 'POST',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Baseline }) => raw.data,
      invalidatesTags: (_result, _error, { baselineId }) => [
        { type: 'Baseline', id: baselineId },
        { type: 'Baseline', id: 'LIST' },
        { type: 'ScheduleHistory', id: 'LIST' },
      ],
    }),

    compareBaseline: builder.query<
      BaselineComparison,
      { orgId: string; projectId: string; baselineId: string }
    >({
      query: ({ orgId, projectId, baselineId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines/${baselineId}/compare`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BaselineComparison }) => raw.data,
      providesTags: (_result, _error, { baselineId }) => [
        { type: 'Baseline', id: `${baselineId}_COMPARE` },
      ],
    }),

    deleteBaseline: builder.mutation<
      void,
      { orgId: string; projectId: string; baselineId: string }
    >({
      query: ({ orgId, projectId, baselineId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/baselines/${baselineId}`,
        method: 'DELETE',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      invalidatesTags: (_result, _error, { baselineId }) => [
        { type: 'Baseline', id: baselineId },
        { type: 'Baseline', id: 'LIST' },
      ],
    }),

    // ────────────────────────────────────────────────────────────────────────
    // Calendar
    // ────────────────────────────────────────────────────────────────────────

    getCalendar: builder.query<Calendar, { orgId: string; projectId: string }>({
      query: ({ orgId, projectId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/calendar`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Calendar }) => raw.data,
      providesTags: [{ type: 'Calendar', id: 'CURRENT' }],
    }),

    updateCalendar: builder.mutation<
      Calendar,
      { orgId: string; projectId: string; data: UpdateCalendarInput }
    >({
      query: ({ orgId, projectId, data }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/calendar`,
        method: 'PATCH',
        body: data,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Calendar }) => raw.data,
      invalidatesTags: [
        { type: 'Calendar', id: 'CURRENT' },
        { type: 'ScheduleMetrics', id: 'CURRENT' },
      ],
    }),

    addCalendarException: builder.mutation<
      Calendar,
      { orgId: string; projectId: string; data: AddCalendarExceptionInput }
    >({
      query: ({ orgId, projectId, data }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/calendar/exceptions`,
        method: 'POST',
        body: data,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Calendar }) => raw.data,
      invalidatesTags: [
        { type: 'Calendar', id: 'CURRENT' },
        { type: 'ScheduleMetrics', id: 'CURRENT' },
      ],
    }),

    removeCalendarException: builder.mutation<
      Calendar,
      { orgId: string; projectId: string; exceptionId: string }
    >({
      query: ({ orgId, projectId, exceptionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/calendar/exceptions/${exceptionId}`,
        method: 'DELETE',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: Calendar }) => raw.data,
      invalidatesTags: [
        { type: 'Calendar', id: 'CURRENT' },
        { type: 'ScheduleMetrics', id: 'CURRENT' },
      ],
    }),
  }),
});

export const {
  // Dependencies
  useListDependenciesQuery,
  useCreateDependencyMutation,
  useDeleteDependencyMutation,
  // Schedule Operations
  useRecalculateScheduleMutation,
  useGetScheduleMetricsQuery,
  useListScheduleHistoryQuery,
  // Baselines
  useListBaselinesQuery,
  useCreateBaselineMutation,
  useGetBaselineQuery,
  useActivateBaselineMutation,
  useCompareBaselineQuery,
  useDeleteBaselineMutation,
  // Calendar
  useGetCalendarQuery,
  useUpdateCalendarMutation,
  useAddCalendarExceptionMutation,
  useRemoveCalendarExceptionMutation,
} = scheduleApi;
