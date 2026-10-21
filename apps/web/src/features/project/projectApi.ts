/**
 * projectApi — Project core CRUD + lifecycle transitions.
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/project/project.routes.ts
 *   GET    /organizations/:orgId/projects?status=&search=&cursor=
 *   GET    /organizations/:orgId/projects/:projectId
 *   POST   /organizations/:orgId/projects
 *   PATCH  /organizations/:orgId/projects/:projectId  (body: UpdateProjectInput with expectedVersion)
 *   POST   /organizations/:orgId/projects/:projectId/{activate|hold|resume|complete|cancel|archive}
 */
import { baseApi } from '../../services/baseApi';
import type { ProjectDTO, CreateProjectInput, UpdateProjectInput, ProjectTransition } from './projectTypes';

// ── Response shapes (server envelope: { success: true, data: T }) ─────────────

interface ListProjectsResponse { projects: ProjectDTO[]; nextCursor: string | null }
interface SingleProjectResponse { project: ProjectDTO }

export const projectApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── List ────────────────────────────────────────────────────────────────
    listProjects: build.query<ListProjectsResponse, {
      orgId: string; status?: string; search?: string; cursor?: string;
    }>({
      query: ({ orgId, status, search, cursor }) => ({
        url: `/organizations/${orgId}/projects`,
        params: {
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(cursor ? { cursor } : {}),
        },
      }),
      transformResponse: (raw: { data: ListProjectsResponse }) => raw.data,
      providesTags: (result, _error, { orgId }) =>
        result
          ? [
              ...result.projects.map((p) => ({ type: 'Project' as const, id: p.id })),
              { type: 'Project' as const, id: `LIST_${orgId}` },
            ]
          : [{ type: 'Project' as const, id: `LIST_${orgId}` }],
    }),

    // ── Get (server returns { project, _version }) ──────────────────────────
    getProject: build.query<SingleProjectResponse & { _version: number }, {
      orgId: string; projectId: string;
    }>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}`,
      transformResponse: (raw: { data: { project: ProjectDTO; _version: number } }) => raw.data,
      providesTags: (_result, _error, { projectId }) => [{ type: 'Project' as const, id: projectId }],
    }),

    // ── Create ──────────────────────────────────────────────────────────────
    createProject: build.mutation<SingleProjectResponse, {
      orgId: string; body: CreateProjectInput;
    }>({
      query: ({ orgId, body }) => ({
        url: `/organizations/${orgId}/projects`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: SingleProjectResponse }) => raw.data,
      invalidatesTags: (_result, _error, { orgId }) => [{ type: 'Project' as const, id: `LIST_${orgId}` }],
    }),

    // ── Update (body includes expectedVersion for optimistic locking) ────────
    updateProject: build.mutation<SingleProjectResponse, {
      orgId: string; projectId: string; body: UpdateProjectInput;
    }>({
      query: ({ orgId, projectId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: SingleProjectResponse }) => raw.data,
      invalidatesTags: (_result, _error, { orgId, projectId }) => [
        { type: 'Project' as const, id: `LIST_${orgId}` },
        { type: 'Project' as const, id: projectId },
      ],
    }),

    // ── Lifecycle transitions ───────────────────────────────────────────────
    transitionProject: build.mutation<SingleProjectResponse, {
      orgId: string; projectId: string; transition: ProjectTransition;
    }>({
      query: ({ orgId, projectId, transition }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/${transition}`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: SingleProjectResponse }) => raw.data,
      invalidatesTags: (_result, _error, { orgId, projectId }) => [
        { type: 'Project' as const, id: `LIST_${orgId}` },
        { type: 'Project' as const, id: projectId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useTransitionProjectMutation,
} = projectApi;
