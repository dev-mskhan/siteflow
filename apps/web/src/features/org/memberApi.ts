/**
 * memberApi — Membership endpoints
 *   GET    /organizations/:orgId/members
 *   GET    /organizations/:orgId/members/:memberId
 *   PATCH  /organizations/:orgId/members/:memberId   { roleId?, status? }
 *   DELETE /organizations/:orgId/members/:memberId
 *
 * Response envelope: { success: true, data: { members | member | nextCursor | message } }
 *
 * Exact MemberDTO fields from membership.service.ts → toMemberDTO():
 *   id, organizationId, userId, roleId, roleName,
 *   userEmail, userFirstName, userLastName,
 *   status (ACTIVE | SUSPENDED | REMOVED),
 *   joinedAt, createdAt, updatedAt
 *
 * Permissions:
 *   GET    → member:read
 *   PATCH  → member:update
 *   DELETE → member:remove
 */
import { baseApi } from '../../services/baseApi';
import type { MemberDTO } from './orgSlice';

interface ListMembersResponse {
  members: MemberDTO[];
  nextCursor: string | null;
}
interface SingleMemberResponse { member: MemberDTO }
interface RemoveMemberResponse { message: string }

export const memberApi = baseApi.injectEndpoints({
  endpoints: (b) => ({

    listMembers: b.query<ListMembersResponse, string>({
      query: (orgId) => `/organizations/${orgId}/members`,
      transformResponse: (r: { data: ListMembersResponse }) => r.data,
      providesTags: (_r, _e, orgId) => [{ type: 'Member', id: orgId }],
    }),

    getMember: b.query<SingleMemberResponse, { orgId: string; memberId: string }>({
      query: ({ orgId, memberId }) => `/organizations/${orgId}/members/${memberId}`,
      transformResponse: (r: { data: SingleMemberResponse }) => r.data,
      providesTags: (_r, _e, { orgId, memberId }) => [{ type: 'Member', id: `${orgId}:${memberId}` }],
    }),

    updateMember: b.mutation<SingleMemberResponse, {
      orgId: string;
      memberId: string;
      body: { roleId?: string; status?: 'ACTIVE' | 'SUSPENDED' };
    }>({
      query: ({ orgId, memberId, body }) => ({
        url: `/organizations/${orgId}/members/${memberId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r: { data: SingleMemberResponse }) => r.data,
      invalidatesTags: (_r, _e, { orgId, memberId }) => [
        { type: 'Member', id: orgId },
        { type: 'Member', id: `${orgId}:${memberId}` },
      ],
    }),

    removeMember: b.mutation<RemoveMemberResponse, { orgId: string; memberId: string }>({
      query: ({ orgId, memberId }) => ({
        url: `/organizations/${orgId}/members/${memberId}`,
        method: 'DELETE',
      }),
      transformResponse: (r: { data: RemoveMemberResponse }) => r.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Member', id: orgId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListMembersQuery,
  useGetMemberQuery,
  useUpdateMemberMutation,
  useRemoveMemberMutation,
} = memberApi;
