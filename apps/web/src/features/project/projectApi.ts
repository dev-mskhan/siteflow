/**
 * projectApi — Project core CRUD + lifecycle transitions.
 * MOCK PHASE: queryFn returns fixture data.
 * REAL INTEGRATION swap per endpoint:
 *   1. Change baseQuery to fetchBaseQuery({ baseUrl:'/api/v1', credentials:'include' })
 *   2. Change queryFn: → query: (args) => `path`
 *   3. Add transformResponse: (r: { data: T }) => r.data
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type { ProjectDTO, CreateProjectInput, UpdateProjectInput, ProjectTransition } from './projectTypes';
import {
  MOCK_PROJECTS,
  MOCK_PROJECT_VERSIONS,
} from '../../mocks/project.fixtures';

interface ListProjectsArgs {
  orgId: string;
  status?: string;
  search?: string;
  cursor?: string;
}

interface ListProjectsResponse { projects: ProjectDTO[]; nextCursor: string | null }
interface SingleProjectResponse { project: ProjectDTO }

export const projectApi = createApi({
  reducerPath: 'projectApi',
  // MOCK: replace with fetchBaseQuery on real integration
  baseQuery: async () => ({ data: undefined as unknown }),
  tagTypes: ['Project'],
  endpoints: (b) => ({

    // ── List ────────────────────────────────────────────────────────────────
    // REAL: query: ({ orgId, status, search, cursor }) =>
    //   `/organizations/${orgId}/projects?${new URLSearchParams({ ...(status && {status}), ...(search && {search}), ...(cursor && {cursor}) })}`
    // transformResponse: (r: { data: ListProjectsResponse }) => r.data
    listProjects: b.query<ListProjectsResponse, ListProjectsArgs>({
      queryFn: ({ orgId, status, search }) => {
        let data = MOCK_PROJECTS.filter((p) => p.organizationId === orgId);
        if (status) data = data.filter((p) => p.status === status);
        if (search) data = data.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
        return { data: { projects: data, nextCursor: null } };
      },
      providesTags: (_r, _e, { orgId }) => [{ type: 'Project', id: orgId }],
    }),

    // ── Get ─────────────────────────────────────────────────────────────────
    // REAL: query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}`
    getProject: b.query<SingleProjectResponse & { _version: number }, { orgId: string; projectId: string }>({
      queryFn: ({ orgId, projectId }) => {
        const project = MOCK_PROJECTS.find((p) => p.id === projectId && p.organizationId === orgId);
        if (!project) return { error: { status: 404, error: 'Project not found' } };
        return { data: { project, _version: MOCK_PROJECT_VERSIONS[projectId] ?? 1 } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Project', id: projectId }],
    }),

    // ── Create ──────────────────────────────────────────────────────────────
    // REAL: query: ({ orgId, body }) => ({ url: `/organizations/${orgId}/projects`, method: 'POST', body })
    createProject: b.mutation<SingleProjectResponse, { orgId: string; body: CreateProjectInput }>({
      queryFn: ({ orgId, body }) => {
        const num = `PRJ-${String(MOCK_PROJECTS.length + 1).padStart(4, '0')}`;
        const project: ProjectDTO = {
          id: `proj_${Date.now()}`,
          organizationId: orgId,
          projectNumber: num,
          name: body.name,
          description: body.description ?? null,
          status: 'DRAFT',
          projectType: body.projectType ?? null,
          contractValue: body.contractValue ?? null,
          currency: body.currency ?? 'PKR',
          plannedStartDate: body.plannedStartDate ?? null,
          plannedEndDate: body.plannedEndDate ?? null,
          actualStartDate: null,
          actualEndDate: null,
          createdBy: 'usr_01',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        MOCK_PROJECTS.push(project);
        MOCK_PROJECT_VERSIONS[project.id] = 1;
        return { data: { project } };
      },
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Project', id: orgId }],
    }),

    // ── Update ──────────────────────────────────────────────────────────────
    // REAL: query: ({ orgId, projectId, body }) => ({ url: `/organizations/${orgId}/projects/${projectId}`, method: 'PATCH', body })
    updateProject: b.mutation<SingleProjectResponse, { orgId: string; projectId: string; body: UpdateProjectInput }>({
      queryFn: ({ orgId, projectId, body }) => {
        const idx = MOCK_PROJECTS.findIndex((p) => p.id === projectId);
        if (idx === -1) return { error: { status: 404, error: 'Not found' } };
        const current = MOCK_PROJECTS[idx]!;
        const updated: ProjectDTO = {
          ...current,
          name: body.name ?? current.name,
          description: body.description !== undefined ? body.description : current.description,
          projectType: body.projectType !== undefined ? body.projectType : current.projectType,
          contractValue: body.contractValue !== undefined ? body.contractValue : current.contractValue,
          plannedStartDate: body.plannedStartDate !== undefined ? body.plannedStartDate : current.plannedStartDate,
          plannedEndDate: body.plannedEndDate !== undefined ? body.plannedEndDate : current.plannedEndDate,
          updatedAt: new Date().toISOString(),
        };
        MOCK_PROJECTS[idx] = updated;
        MOCK_PROJECT_VERSIONS[projectId] = (MOCK_PROJECT_VERSIONS[projectId] ?? 1) + 1;
        return { data: { project: updated } };
      },
      invalidatesTags: (_r, _e, { orgId, projectId }) => [
        { type: 'Project', id: orgId },
        { type: 'Project', id: projectId },
      ],
    }),

    // ── Lifecycle ───────────────────────────────────────────────────────────
    // REAL: query: ({ orgId, projectId, transition }) => ({ url: `/organizations/${orgId}/projects/${projectId}/${transition}`, method: 'POST' })
    transitionProject: b.mutation<SingleProjectResponse, { orgId: string; projectId: string; transition: ProjectTransition }>({
      queryFn: ({ orgId, projectId, transition }) => {
        const idx = MOCK_PROJECTS.findIndex((p) => p.id === projectId);
        if (idx === -1) return { error: { status: 404, error: 'Not found' } };
        const current = MOCK_PROJECTS[idx]!;
        const map: Record<ProjectTransition, ProjectDTO['status']> = {
          activate: 'ACTIVE', hold: 'ON_HOLD', resume: 'ACTIVE',
          complete: 'COMPLETED', cancel: 'CANCELLED', archive: 'ARCHIVED',
        };
        const updated: ProjectDTO = {
          ...current,
          status: map[transition],
          actualStartDate: transition === 'activate' ? (current.actualStartDate ?? new Date().toISOString().split('T')[0]!) : current.actualStartDate,
          actualEndDate: transition === 'complete' ? new Date().toISOString().split('T')[0]! : current.actualEndDate,
          updatedAt: new Date().toISOString(),
        };
        MOCK_PROJECTS[idx] = updated;
        return { data: { project: updated } };
      },
      invalidatesTags: (_r, _e, { orgId, projectId }) => [
        { type: 'Project', id: orgId },
        { type: 'Project', id: projectId },
      ],
    }),

  }),
});

export const {
  useListProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useTransitionProjectMutation,
} = projectApi;
