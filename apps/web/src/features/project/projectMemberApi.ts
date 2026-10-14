/**
 * projectMemberApi — Project-level team members.
 * Note: These are PROJECT members (ProjectRole), NOT org members (OrgRole).
 * Last-PM guard: server returns 422 when removing/demoting the last PROJECT_MANAGER.
 * MOCK PHASE: queryFn returns MOCK_PROJECT_MEMBERS fixture data.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type { ProjectMemberDTO, ProjectRole } from './projectTypes';
import { MOCK_PROJECT_MEMBERS } from '../../mocks/project.fixtures';

interface Args { orgId: string; projectId: string }
interface ListResponse { members: ProjectMemberDTO[] }
interface SingleResponse { member: ProjectMemberDTO }

export const projectMemberApi = createApi({
  reducerPath: 'projectMemberApi',
  baseQuery: async () => ({ data: undefined as unknown }),
  tagTypes: ['ProjectMember'],
  endpoints: (b) => ({

    // REAL: query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/members`
    listProjectMembers: b.query<ListResponse, Args>({
      queryFn: ({ projectId }) => ({
        data: { members: (MOCK_PROJECT_MEMBERS[projectId] ?? []).filter((m) => m.status === 'ACTIVE') },
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'ProjectMember', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, body }) => ({ url: `.../members`, method: 'POST', body })
    addProjectMember: b.mutation<SingleResponse, Args & { body: { userId: string; role: ProjectRole } }>({
      queryFn: ({ projectId, body }) => {
        const members = MOCK_PROJECT_MEMBERS[projectId] ?? [];
        const member: ProjectMemberDTO = {
          id: `pm_${Date.now()}`,
          userId: body.userId,
          role: body.role,
          status: 'ACTIVE',
          addedBy: 'usr_01',
          createdAt: new Date().toISOString(),
          user: { id: body.userId, firstName: 'New', lastName: 'Member', email: `${body.userId}@company.com` },
        };
        MOCK_PROJECT_MEMBERS[projectId] = [...members, member];
        return { data: { member } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ProjectMember', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, userId, body }) => ({ url: `.../members/${userId}`, method: 'PATCH', body })
    updateMemberRole: b.mutation<SingleResponse, Args & { userId: string; body: { role: ProjectRole } }>({
      queryFn: ({ projectId, userId, body }) => {
        const members = MOCK_PROJECT_MEMBERS[projectId] ?? [];
        const idx = members.findIndex((m) => m.userId === userId);
        if (idx === -1) return { error: { status: 404, error: 'Not found' } };
        const updated = { ...members[idx]!, role: body.role };
        MOCK_PROJECT_MEMBERS[projectId] = members.map((m, i) => (i === idx ? updated : m));
        return { data: { member: updated } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ProjectMember', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, userId }) => ({ url: `.../members/${userId}`, method: 'DELETE' }) → 204
    removeProjectMember: b.mutation<void, Args & { userId: string }>({
      queryFn: ({ projectId, userId }) => {
        const members = MOCK_PROJECT_MEMBERS[projectId] ?? [];
        MOCK_PROJECT_MEMBERS[projectId] = members.map((m) =>
          m.userId === userId ? { ...m, status: 'REMOVED' as const } : m,
        );
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ProjectMember', id: projectId }],
    }),

  }),
});

export const {
  useListProjectMembersQuery,
  useAddProjectMemberMutation,
  useUpdateMemberRoleMutation,
  useRemoveProjectMemberMutation,
} = projectMemberApi;
