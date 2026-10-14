/**
 * phaseApi — Project phases CRUD + reorder.
 * MOCK PHASE: queryFn returns MOCK_PHASES fixture data.
 * REAL swap: baseQuery → fetchBaseQuery, queryFn → query, add transformResponse.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type { PhaseDTO } from './projectTypes';
import { MOCK_PHASES } from '../../mocks/project.fixtures';

interface PhaseArgs { orgId: string; projectId: string }
interface PhaseMutArgs extends PhaseArgs { phaseId: string }
interface ListPhasesResponse { phases: PhaseDTO[] }
interface SinglePhaseResponse { phase: PhaseDTO }

export const phaseApi = createApi({
  reducerPath: 'phaseApi',
  baseQuery: async () => ({ data: undefined as unknown }),
  tagTypes: ['Phase'],
  endpoints: (b) => ({

    // REAL: query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/phases`
    listPhases: b.query<ListPhasesResponse, PhaseArgs>({
      queryFn: ({ projectId }) => ({
        data: { phases: (MOCK_PHASES[projectId] ?? []).filter((p) => p.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder) },
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Phase', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, body }) => ({ url: `/organizations/${orgId}/projects/${projectId}/phases`, method: 'POST', body })
    createPhase: b.mutation<SinglePhaseResponse, PhaseArgs & { body: { name: string; description?: string; startsAt?: string; endsAt?: string } }>({
      queryFn: ({ projectId, orgId, body }) => {
        const phases = MOCK_PHASES[projectId] ?? [];
        const maxOrder = phases.reduce((m, p) => Math.max(m, p.sortOrder), -1);
        const phase: PhaseDTO = {
          id: `phase_${Date.now()}`,
          projectId,
          organizationId: orgId,
          name: body.name,
          description: body.description ?? null,
          status: 'ACTIVE',
          sortOrder: maxOrder + 1,
          startsAt: body.startsAt ?? null,
          endsAt: body.endsAt ?? null,
          createdBy: 'usr_01',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        MOCK_PHASES[projectId] = [...phases, phase];
        return { data: { phase } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Phase', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, phaseId, body }) => ({ url: `.../phases/${phaseId}`, method: 'PATCH', body })
    updatePhase: b.mutation<SinglePhaseResponse, PhaseMutArgs & { body: { name?: string; description?: string | null; startsAt?: string | null; endsAt?: string | null } }>({
      queryFn: ({ projectId, phaseId, body }) => {
        const phases = MOCK_PHASES[projectId] ?? [];
        const idx = phases.findIndex((p) => p.id === phaseId);
        if (idx === -1) return { error: { status: 404, error: 'Phase not found' } };
        const updated = { ...phases[idx]!, ...body, updatedAt: new Date().toISOString() };
        MOCK_PHASES[projectId] = phases.map((p, i) => (i === idx ? updated : p));
        return { data: { phase: updated } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Phase', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, phaseId }) => ({ url: `.../phases/${phaseId}`, method: 'DELETE' }) → 204
    archivePhase: b.mutation<void, PhaseMutArgs>({
      queryFn: ({ projectId, phaseId }) => {
        const phases = MOCK_PHASES[projectId] ?? [];
        MOCK_PHASES[projectId] = phases.map((p) => p.id === phaseId ? { ...p, status: 'ARCHIVED' as const, updatedAt: new Date().toISOString() } : p);
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Phase', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, body }) => ({ url: `.../phases/reorder`, method: 'POST', body })
    reorderPhases: b.mutation<ListPhasesResponse, PhaseArgs & { body: { orderedIds: string[] } }>({
      queryFn: ({ projectId, body }) => {
        const phases = MOCK_PHASES[projectId] ?? [];
        body.orderedIds.forEach((id, idx) => {
          const p = phases.find((ph) => ph.id === id);
          if (p) p.sortOrder = idx;
        });
        const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
        MOCK_PHASES[projectId] = sorted;
        return { data: { phases: sorted.filter((p) => p.status === 'ACTIVE') } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Phase', id: projectId }],
    }),

  }),
});

export const {
  useListPhasesQuery,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useArchivePhaseMutation,
  useReorderPhasesMutation,
} = phaseApi;
