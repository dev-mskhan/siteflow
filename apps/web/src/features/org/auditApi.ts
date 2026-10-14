/**
 * auditApi — GET /organizations/:orgId/audit-logs?limit=50&offset=0
 * Response envelope: { success: true, data: { logs }, meta: { limit, offset, total } }
 * Permission: audit:read
 */
import { baseApi } from '../../services/baseApi';

export interface AuditLogDTO {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  projectId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'organization.created':                   'Created organization',
  'organization.updated':                   'Updated organization name',
  'organization.profile_updated':           'Updated organization profile',
  'organization.settings_updated':          'Updated settings',
  'organization.document_sequence_updated': 'Updated document sequence',
  'member.invited':                         'Invited a member',
  'member.joined':                          'Member joined',
  'member.updated':                         'Updated member',
  'member.role_changed':                    'Changed member role',
  'member.suspended':                       'Suspended member',
  'member.reactivated':                     'Reactivated member',
  'member.removed':                         'Removed member',
  'invitation.cancelled':                   'Cancelled invitation',
  'invitation.accepted':                    'Accepted invitation',
  'permission.denied':                      'Permission denied',
};

interface ListAuditLogsResponse { logs: AuditLogDTO[] }

export const auditApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listAuditLogs: b.query<ListAuditLogsResponse, { orgId: string; limit?: number; offset?: number }>({
      query: ({ orgId, limit = 50, offset = 0 }) =>
        `/organizations/${orgId}/audit-logs?limit=${limit}&offset=${offset}`,
      transformResponse: (r: { data: ListAuditLogsResponse }) => r.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'AuditLog', id: orgId }],
    }),
  }),
  overrideExisting: false,
});

export const { useListAuditLogsQuery } = auditApi;
