/**
 * costCodeApi — Project cost codes CRUD + deactivate.
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/project/project.routes.ts
 *   GET    /organizations/:orgId/projects/:projectId/cost-codes?includeInactive=true
 *   POST   /organizations/:orgId/projects/:projectId/cost-codes
 *   PATCH  /organizations/:orgId/projects/:projectId/cost-codes/:codeId
 *   DELETE /organizations/:orgId/projects/:projectId/cost-codes/:codeId
 */
import { baseApi } from '../../services/baseApi';
import type { CostCodeDTO } from './projectTypes';

interface Args { orgId: string; projectId: string }
interface SingleArgs extends Args { codeId: string }
interface ListResponse { costCodes: CostCodeDTO[] }
interface SingleResponse { costCode: CostCodeDTO }

export const costCodeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    listCostCodes: build.query<ListResponse, Args & { includeInactive?: boolean }>({
      query: ({ orgId, projectId, includeInactive }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-codes`,
        params: includeInactive ? { includeInactive: 'true' } : {},
      }),
      transformResponse: (raw: { data: ListResponse }) => raw.data,
      providesTags: (_result, _error, { projectId }) => [{ type: 'CostCode' as const, id: projectId }],
    }),

    createCostCode: build.mutation<SingleResponse, Args & {
      body: { code: string; description?: string };
    }>({
      query: ({ orgId, projectId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-codes`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: SingleResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'CostCode' as const, id: projectId }],
    }),

    updateCostCode: build.mutation<SingleResponse, SingleArgs & {
      body: { code?: string; description?: string | null };
    }>({
      query: ({ orgId, projectId, codeId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-codes/${codeId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: SingleResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'CostCode' as const, id: projectId }],
    }),

    deactivateCostCode: build.mutation<void, SingleArgs>({
      query: ({ orgId, projectId, codeId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/cost-codes/${codeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'CostCode' as const, id: projectId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListCostCodesQuery,
  useCreateCostCodeMutation,
  useUpdateCostCodeMutation,
  useDeactivateCostCodeMutation,
} = costCodeApi;
