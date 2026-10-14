/**
 * costCodeApi — Project cost codes CRUD + deactivate.
 * MOCK PHASE: queryFn returns MOCK_COST_CODES fixture data.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type { CostCodeDTO } from './projectTypes';
import { MOCK_COST_CODES } from '../../mocks/project.fixtures';

interface Args { orgId: string; projectId: string }
interface SingleArgs extends Args { codeId: string }
interface ListResponse { costCodes: CostCodeDTO[] }
interface SingleResponse { costCode: CostCodeDTO }

export const costCodeApi = createApi({
  reducerPath: 'costCodeApi',
  baseQuery: async () => ({ data: undefined as unknown }),
  tagTypes: ['CostCode'],
  endpoints: (b) => ({

    // REAL: query: ({ orgId, projectId, includeInactive }) =>
    //   `/organizations/${orgId}/projects/${projectId}/cost-codes${includeInactive ? '?includeInactive=true' : ''}`
    listCostCodes: b.query<ListResponse, Args & { includeInactive?: boolean }>({
      queryFn: ({ projectId, includeInactive }) => {
        let codes = MOCK_COST_CODES[projectId] ?? [];
        if (!includeInactive) codes = codes.filter((c) => c.isActive);
        return { data: { costCodes: codes } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'CostCode', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, body }) => ({ url: `.../cost-codes`, method: 'POST', body })
    createCostCode: b.mutation<SingleResponse, Args & { body: { code: string; description?: string } }>({
      queryFn: ({ projectId, orgId, body }) => {
        const codes = MOCK_COST_CODES[projectId] ?? [];
        const code: CostCodeDTO = {
          id: `cc_${Date.now()}`,
          projectId,
          organizationId: orgId,
          code: body.code.toUpperCase(),
          description: body.description ?? null,
          isActive: true,
          createdBy: 'usr_01',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        MOCK_COST_CODES[projectId] = [...codes, code];
        return { data: { costCode: code } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CostCode', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, codeId, body }) => ({ url: `.../cost-codes/${codeId}`, method: 'PATCH', body })
    updateCostCode: b.mutation<SingleResponse, SingleArgs & { body: { code?: string; description?: string | null } }>({
      queryFn: ({ projectId, codeId, body }) => {
        const codes = MOCK_COST_CODES[projectId] ?? [];
        const idx = codes.findIndex((c) => c.id === codeId);
        if (idx === -1) return { error: { status: 404, error: 'Not found' } };
        const updated = {
          ...codes[idx]!,
          ...(body.code !== undefined ? { code: body.code.toUpperCase() } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          updatedAt: new Date().toISOString(),
        };
        MOCK_COST_CODES[projectId] = codes.map((c, i) => (i === idx ? updated : c));
        return { data: { costCode: updated } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CostCode', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, codeId }) => ({ url: `.../cost-codes/${codeId}`, method: 'DELETE' }) → 204
    deactivateCostCode: b.mutation<void, SingleArgs>({
      queryFn: ({ projectId, codeId }) => {
        const codes = MOCK_COST_CODES[projectId] ?? [];
        MOCK_COST_CODES[projectId] = codes.map((c) => c.id === codeId ? { ...c, isActive: false, updatedAt: new Date().toISOString() } : c);
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CostCode', id: projectId }],
    }),

  }),
});

export const {
  useListCostCodesQuery,
  useCreateCostCodeMutation,
  useUpdateCostCodeMutation,
  useDeactivateCostCodeMutation,
} = costCodeApi;
