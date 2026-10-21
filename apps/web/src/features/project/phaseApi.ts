/**
 * phaseApi — Project phases CRUD + reorder.
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/project/project.routes.ts
 *   GET    /organizations/:orgId/projects/:projectId/phases
 *   POST   /organizations/:orgId/projects/:projectId/phases
 *   PATCH  /organizations/:orgId/projects/:projectId/phases/:phaseId
 *   DELETE /organizations/:orgId/projects/:projectId/phases/:phaseId
 *   POST   /organizations/:orgId/projects/:projectId/phases/reorder
 */
import { baseApi } from '../../services/baseApi';
import type { PhaseDTO } from './projectTypes';

interface PhaseArgs { orgId: string; projectId: string }
interface PhaseMutArgs extends PhaseArgs { phaseId: string }
interface ListPhasesResponse { phases: PhaseDTO[] }
interface SinglePhaseResponse { phase: PhaseDTO }

export const phaseApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    listPhases: build.query<ListPhasesResponse, PhaseArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/phases`,
      transformResponse: (raw: { data: ListPhasesResponse }) => raw.data,
      providesTags: (_result, _error, { projectId }) => [{ type: 'Phase' as const, id: projectId }],
    }),

    createPhase: build.mutation<SinglePhaseResponse, PhaseArgs & {
      body: { name: string; description?: string; startsAt?: string; endsAt?: string };
    }>({
      query: ({ orgId, projectId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/phases`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: SinglePhaseResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Phase' as const, id: projectId }],
    }),

    updatePhase: build.mutation<SinglePhaseResponse, PhaseMutArgs & {
      body: { name?: string; description?: string | null; startsAt?: string | null; endsAt?: string | null };
    }>({
      query: ({ orgId, projectId, phaseId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/phases/${phaseId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: SinglePhaseResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Phase' as const, id: projectId }],
    }),

    archivePhase: build.mutation<void, PhaseMutArgs>({
      query: ({ orgId, projectId, phaseId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/phases/${phaseId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Phase' as const, id: projectId }],
    }),

    reorderPhases: build.mutation<ListPhasesResponse, PhaseArgs & {
      body: { orderedIds: string[] };
    }>({
      query: ({ orgId, projectId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/phases/reorder`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: ListPhasesResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Phase' as const, id: projectId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListPhasesQuery,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useArchivePhaseMutation,
  useReorderPhasesMutation,
} = phaseApi;
