/**
 * invitationApi — Invitation endpoints
 *
 *   POST   /organizations/:orgId/invitations          { email, roleId, orgName?, inviterName? }
 *   GET    /organizations/:orgId/invitations
 *   DELETE /organizations/:orgId/invitations/:id
 *   POST   /invitations/:token/accept                 (token in URL, no body)
 *
 * Response envelope: { success: true, data: { invitation | invitations | nextCursor | message } }
 *
 * Exact InvitationDTO fields from invitation.service.ts → toInvitationDTO():
 *   id, organizationId, email, roleId, roleName,
 *   status (PENDING | ACCEPTED | EXPIRED | CANCELLED),
 *   expiresAt, acceptedAt, invitedBy, createdAt
 *
 * Permissions:
 *   POST create → member:invite
 *   GET list    → member:read
 *   DELETE      → invitation:cancel
 *   POST accept → authenticate only (no org context)
 */
import { baseApi } from '../../services/baseApi';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface InvitationDTO {
  id: string;
  organizationId: string;
  email: string;
  roleId: string;
  roleName: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  invitedBy: string;
  createdAt: string;
}

export interface CreateInvitationInput {
  email: string;           // validated as email by server
  roleId: string;          // UUID — must belong to this org
  orgName?: string;        // optional — used in invitation email copy
  inviterName?: string;    // optional — used in invitation email copy
}

interface ListInvitationsResponse {
  invitations: InvitationDTO[];
  nextCursor: string | null;
}
interface SingleInvitationResponse { invitation: InvitationDTO }
interface MessageResponse { message: string }

export const invitationApi = baseApi.injectEndpoints({
  endpoints: (b) => ({

    createInvitation: b.mutation<SingleInvitationResponse, {
      orgId: string;
      body: CreateInvitationInput;
    }>({
      query: ({ orgId, body }) => ({
        url: `/organizations/${orgId}/invitations`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: { data: SingleInvitationResponse }) => r.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Invitation', id: orgId }],
    }),

    listInvitations: b.query<ListInvitationsResponse, string>({
      query: (orgId) => `/organizations/${orgId}/invitations`,
      transformResponse: (r: { data: ListInvitationsResponse }) => r.data,
      providesTags: (_r, _e, orgId) => [{ type: 'Invitation', id: orgId }],
    }),

    cancelInvitation: b.mutation<MessageResponse, { orgId: string; id: string }>({
      query: ({ orgId, id }) => ({
        url: `/organizations/${orgId}/invitations/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (r: { data: MessageResponse }) => r.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Invitation', id: orgId }],
    }),

    acceptInvitation: b.mutation<MessageResponse, string>({
      // token is in the URL param — no request body
      query: (token) => ({
        url: `/invitations/${token}/accept`,
        method: 'POST',
      }),
      transformResponse: (r: { data: MessageResponse }) => r.data,
      // After accepting, org list changes for the current user
      invalidatesTags: ['Organization'],
    }),

  }),
  overrideExisting: false,
});

export const {
  useCreateInvitationMutation,
  useListInvitationsQuery,
  useCancelInvitationMutation,
  useAcceptInvitationMutation,
} = invitationApi;
