/**
 * projectMemberApi — Project-level team members.
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/project/project.routes.ts
 *   GET    /organizations/:orgId/projects/:projectId/members
 *   POST   /organizations/:orgId/projects/:projectId/members
 *   PATCH  /organizations/:orgId/projects/:projectId/members/:userId
 *   DELETE /organizations/:orgId/projects/:projectId/members/:userId
 *
 * Note: These are PROJECT members (ProjectRole), NOT org members (OrgRole).
 * Last-PM guard: server returns 422 when removing/demoting the last PROJECT_MANAGER.
 */
import { baseApi } from '../../services/baseApi';
import type { ProjectMemberDTO, ProjectRole } from './projectTypes';

interface Args { orgId: string; projectId: string }
interface ListResponse { members: ProjectMemberDTO[] }
interface SingleResponse { member: ProjectMemberDTO }

export const projectMemberApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    listProjectMembers: build.query<ListResponse, Args>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/members`,
      transformResponse: (raw: { data: ListResponse }) => raw.data,
      providesTags: (_result, _error, { projectId }) => [{ type: 'ProjectMember' as const, id: projectId }],
    }),

    addProjectMember: build.mutation<SingleResponse, Args & {
      body: { userId: string; role: ProjectRole };
    }>({
      query: ({ orgId, projectId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/members`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: SingleResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'ProjectMember' as const, id: projectId }],
    }),

    updateMemberRole: build.mutation<SingleResponse, Args & {
      userId: string; body: { role: ProjectRole };
    }>({
      query: ({ orgId, projectId, userId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/members/${userId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: SingleResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'ProjectMember' as const, id: projectId }],
    }),

    removeProjectMember: build.mutation<void, Args & { userId: string }>({
      query: ({ orgId, projectId, userId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/members/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'ProjectMember' as const, id: projectId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListProjectMembersQuery,
  useAddProjectMemberMutation,
  useUpdateMemberRoleMutation,
  useRemoveProjectMemberMutation,
} = projectMemberApi;
