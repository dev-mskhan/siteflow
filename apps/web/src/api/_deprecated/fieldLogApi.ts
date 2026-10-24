import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  FieldLogDTO,
  FieldLogAmendmentDTO,
  CreateFieldLogInput,
  UpdateFieldLogInput,
  CreateAmendmentInput,
} from '../types/fieldLogTypes';
import {
  MOCK_FIELD_LOGS,
  MOCK_FIELD_LOG_ENTRIES,
  MOCK_FIELD_LOG_AMENDMENTS,
} from '../fixtures/field-log.fixtures';

export const fieldLogApi = createApi({
  reducerPath: 'fieldLogApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['FieldLog', 'Amendment'],
  endpoints: (build) => ({
    listFieldLogs: build.query<{ data: FieldLogDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await new Promise((r) => setTimeout(r, 150));
        const logs = (MOCK_FIELD_LOGS[projectId] || []).map((log) => ({
          ...log,
          entries: undefined,
        }));
        return { data: { data: logs } };
      },
      providesTags: (result, _error, { projectId }) => [
        { type: 'FieldLog', id: 'LIST' },
        { type: 'FieldLog', id: projectId },
      ],
    }),

    getFieldLog: build.query<FieldLogDTO, { orgId: string; projectId: string; logId: string }>({
      queryFn: async ({ projectId, logId }) => {
        await new Promise((r) => setTimeout(r, 120));
        const log = MOCK_FIELD_LOGS[projectId]?.find((l) => l.id === logId);
        if (!log) return { error: { status: 404, error: 'FIELD_LOG_NOT_FOUND' } };
        const entries = MOCK_FIELD_LOG_ENTRIES[logId] || [];
        return { data: { ...log, entries } };
      },
      providesTags: (_result, _error, { logId }) => [{ type: 'FieldLog', id: logId }],
    }),

    createFieldLog: build.mutation<
      FieldLogDTO,
      { orgId: string; projectId: string; input: CreateFieldLogInput }
    >({
      queryFn: async ({ projectId, input }) => {
        await new Promise((r) => setTimeout(r, 200));
        const existingLogs = MOCK_FIELD_LOGS[projectId] || [];
        if (existingLogs.some((l) => l.logDate === input.logDate)) {
          return { error: { status: 409, error: 'FIELD_LOG_DUPLICATE_DATE' } };
        }
        const newLog: FieldLogDTO = {
          id: `log_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          logDate: input.logDate,
          supervisorId: 'usr_01',
          status: 'DRAFT',
          notes: input.notes || null,
          lockedAt: null,
          createdAt: new Date().toISOString(),
          entries: [],
        };
        MOCK_FIELD_LOGS[projectId] = [...existingLogs, newLog];
        return { data: newLog };
      },
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'FieldLog', id: projectId }],
    }),

    updateFieldLog: build.mutation<
      FieldLogDTO,
      { orgId: string; projectId: string; logId: string; input: UpdateFieldLogInput }
    >({
      queryFn: async ({ projectId, logId, input }) => {
        await new Promise((r) => setTimeout(r, 180));
        const log = MOCK_FIELD_LOGS[projectId]?.find((l) => l.id === logId);
        if (!log) return { error: { status: 404, error: 'FIELD_LOG_NOT_FOUND' } };
        if (log.status !== 'DRAFT') {
          return { error: { status: 422, error: 'FIELD_LOG_IMMUTABLE' } };
        }
        const updated = { ...log, ...input };
        MOCK_FIELD_LOGS[projectId] = MOCK_FIELD_LOGS[projectId].map((l) =>
          l.id === logId ? updated : l
        );
        return { data: updated };
      },
      invalidatesTags: (_result, _error, { projectId, logId }) => [
        { type: 'FieldLog', id: logId },
        { type: 'FieldLog', id: projectId },
      ],
    }),

    submitFieldLog: build.mutation<
      FieldLogDTO,
      { orgId: string; projectId: string; logId: string }
    >({
      queryFn: async ({ projectId, logId }) => {
        await new Promise((r) => setTimeout(r, 150));
        const log = MOCK_FIELD_LOGS[projectId]?.find((l) => l.id === logId);
        if (!log) return { error: { status: 404, error: 'FIELD_LOG_NOT_FOUND' } };
        if (log.status !== 'DRAFT') {
          return { error: { status: 422, error: 'FIELD_LOG_INVALID_TRANSITION' } };
        }
        const updated = { ...log, status: 'SUBMITTED' as const };
        MOCK_FIELD_LOGS[projectId] = MOCK_FIELD_LOGS[projectId].map((l) =>
          l.id === logId ? updated : l
        );
        return { data: updated };
      },
      invalidatesTags: (_result, _error, { projectId, logId }) => [
        { type: 'FieldLog', id: logId },
        { type: 'FieldLog', id: projectId },
      ],
    }),

    lockFieldLog: build.mutation<FieldLogDTO, { orgId: string; projectId: string; logId: string }>(
      {
        queryFn: async ({ projectId, logId }) => {
          await new Promise((r) => setTimeout(r, 150));
          const log = MOCK_FIELD_LOGS[projectId]?.find((l) => l.id === logId);
          if (!log) return { error: { status: 404, error: 'FIELD_LOG_NOT_FOUND' } };
          if (log.status !== 'SUBMITTED') {
            return { error: { status: 422, error: 'FIELD_LOG_INVALID_TRANSITION' } };
          }
          const updated = {
            ...log,
            status: 'LOCKED' as const,
            lockedAt: new Date().toISOString(),
          };
          MOCK_FIELD_LOGS[projectId] = MOCK_FIELD_LOGS[projectId].map((l) =>
            l.id === logId ? updated : l
          );
          return { data: updated };
        },
        invalidatesTags: (_result, _error, { projectId, logId }) => [
          { type: 'FieldLog', id: logId },
          { type: 'FieldLog', id: projectId },
        ],
      }
    ),

    listAmendments: build.query<
      { data: FieldLogAmendmentDTO[] },
      { orgId: string; projectId: string; logId: string }
    >({
      queryFn: async ({ logId }) => {
        await new Promise((r) => setTimeout(r, 100));
        const amendments = MOCK_FIELD_LOG_AMENDMENTS[logId] || [];
        return { data: { data: amendments } };
      },
      providesTags: (_result, _error, { logId }) => [{ type: 'Amendment', id: logId }],
    }),

    getAmendment: build.query<
      FieldLogAmendmentDTO,
      { orgId: string; projectId: string; logId: string; amendmentId: string }
    >({
      queryFn: async ({ logId, amendmentId }) => {
        await new Promise((r) => setTimeout(r, 100));
        const amendment = MOCK_FIELD_LOG_AMENDMENTS[logId]?.find((a) => a.id === amendmentId);
        if (!amendment) return { error: { status: 404, error: 'AMENDMENT_NOT_FOUND' } };
        return { data: amendment };
      },
      providesTags: (_result, _error, { amendmentId }) => [{ type: 'Amendment', id: amendmentId }],
    }),

    createAmendment: build.mutation<
      FieldLogAmendmentDTO,
      { orgId: string; projectId: string; logId: string; input: CreateAmendmentInput }
    >({
      queryFn: async ({ projectId, logId, input }) => {
        await new Promise((r) => setTimeout(r, 200));
        const log = MOCK_FIELD_LOGS[projectId]?.find((l) => l.id === logId);
        if (!log) return { error: { status: 404, error: 'FIELD_LOG_NOT_FOUND' } };
        if (log.status !== 'LOCKED') {
          return { error: { status: 422, error: 'AMENDMENT_NOT_ALLOWED' } };
        }
        const newAmendment: FieldLogAmendmentDTO = {
          id: `amendment_${Date.now()}`,
          logId,
          organizationId: log.organizationId,
          projectId,
          requestedBy: 'usr_01',
          approvedBy: null,
          approvedAt: null,
          reason: input.reason,
          correction: input.correction,
          createdAt: new Date().toISOString(),
        };
        MOCK_FIELD_LOG_AMENDMENTS[logId] = [
          ...(MOCK_FIELD_LOG_AMENDMENTS[logId] || []),
          newAmendment,
        ];
        return { data: newAmendment };
      },
      invalidatesTags: (_result, _error, { logId }) => [{ type: 'Amendment', id: logId }],
    }),
  }),
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
