/**
 * fieldLogApi — Live integration for daily field logs and amendments.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Backend: apps/server/src/modules/project/field-log/*.handler.ts
 */
import { baseApi } from '../../services/baseApi';
import type {
  FieldLogDTO,
  FieldLogAmendmentDTO,
  CreateFieldLogInput,
  UpdateFieldLogInput,
  CreateAmendmentInput,
} from '../../types/fieldLogTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const fieldLogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    
    listFieldLogs: build.query<{ data: FieldLogDTO[] }, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/field-logs`,
      transformResponse: (raw: { data: FieldLogDTO[] }) => ({ data: raw.data }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'FieldLog', id: projectId }],
    }),

    getFieldLog: build.query<FieldLogDTO, OrgProjectArgs & { logId: string }>({
      query: ({ orgId, projectId, logId }) =>
        `/organizations/${orgId}/projects/${projectId}/field-logs/${logId}`,
      transformResponse: (raw: { data: FieldLogDTO }) => raw.data,
      providesTags: (_r, _e, { logId }) => [{ type: 'FieldLog', id: logId }],
    }),

    createFieldLog: build.mutation<FieldLogDTO, OrgProjectArgs & { input: CreateFieldLogInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/field-logs`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: FieldLogDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'FieldLog', id: projectId }],
    }),

    updateFieldLog: build.mutation<FieldLogDTO, OrgProjectArgs & { logId: string; input: UpdateFieldLogInput }>({
      query: ({ orgId, projectId, logId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/field-logs/${logId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: FieldLogDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, logId }) => [
        { type: 'FieldLog', id: logId },
        { type: 'FieldLog', id: projectId },
      ],
    }),

    submitFieldLog: build.mutation<FieldLogDTO, OrgProjectArgs & { logId: string }>({
      query: ({ orgId, projectId, logId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/field-logs/${logId}/submit`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: FieldLogDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, logId }) => [
        { type: 'FieldLog', id: logId },
        { type: 'FieldLog', id: projectId },
      ],
    }),

    lockFieldLog: build.mutation<FieldLogDTO, OrgProjectArgs & { logId: string }>({
      query: ({ orgId, projectId, logId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/field-logs/${logId}/lock`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: FieldLogDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, logId }) => [
        { type: 'FieldLog', id: logId },
        { type: 'FieldLog', id: projectId },
      ],
    }),

    listAmendments: build.query<{ data: FieldLogAmendmentDTO[] }, OrgProjectArgs & { logId: string }>({
      query: ({ orgId, projectId, logId }) =>
        `/organizations/${orgId}/projects/${projectId}/field-logs/${logId}/amendments`,
      transformResponse: (raw: { data: FieldLogAmendmentDTO[] }) => ({ data: raw.data }),
      providesTags: (_r, _e, { logId }) => [{ type: 'Amendment', id: logId }],
    }),

    getAmendment: build.query<FieldLogAmendmentDTO, OrgProjectArgs & { logId: string; amendmentId: string }>({
      query: ({ orgId, projectId, logId, amendmentId }) =>
        `/organizations/${orgId}/projects/${projectId}/field-logs/${logId}/amendments/${amendmentId}`,
      transformResponse: (raw: { data: FieldLogAmendmentDTO }) => raw.data,
      providesTags: (_r, _e, { amendmentId }) => [{ type: 'Amendment', id: amendmentId }],
    }),

    createAmendment: build.mutation<FieldLogAmendmentDTO, OrgProjectArgs & { logId: string; input: CreateAmendmentInput }>({
      query: ({ orgId, projectId, logId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/field-logs/${logId}/amendments`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: FieldLogAmendmentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { logId }) => [{ type: 'Amendment', id: logId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListFieldLogsQuery,
  useGetFieldLogQuery,
  useCreateFieldLogMutation,
  useUpdateFieldLogMutation,
  useSubmitFieldLogMutation,
  useLockFieldLogMutation,
  useListAmendmentsQuery,
  useGetAmendmentQuery,
  useCreateAmendmentMutation,
} = fieldLogApi;
