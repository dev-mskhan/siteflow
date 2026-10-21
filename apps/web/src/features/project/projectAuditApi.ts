/**
 * projectAuditApi — Cursor-paginated project audit log.
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/project/project.routes.ts
 *   GET /organizations/:orgId/projects/:projectId/audit
 *   Query: resourceType?, actorUserId?, action?, dateFrom?, dateTo?, cursor?, limit?
 *   Response: { auditLogs, nextCursor }
 */
import { baseApi } from '../../services/baseApi';

export interface ProjectAuditLogDTO {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  projectId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ProjectAuditQuery {
  orgId: string;
  projectId: string;
  resourceType?: string;
  actorUserId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string | null;
  limit?: number;
}

interface ListResponse {
  auditLogs: ProjectAuditLogDTO[];
  nextCursor: string | null;
}

export const projectAuditApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    listProjectAudit: build.query<ListResponse, ProjectAuditQuery>({
      query: ({ orgId, projectId, cursor, limit, ...filters }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/audit`,
        params: {
          ...Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
          ),
          ...(cursor ? { cursor } : {}),
          ...(limit ? { limit: String(limit) } : {}),
        },
      }),
      transformResponse: (raw: { data: ListResponse }) => raw.data,
      providesTags: (_result, _error, { projectId }) => [{ type: 'Project' as const, id: `${projectId}-audit` }],
    }),

  }),
  overrideExisting: false,
});

export const { useListProjectAuditQuery } = projectAuditApi;
