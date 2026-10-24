/**
 * exportApi — Live integration for CSV/Excel export generation.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Flow:
 *   1. requestExport → 202 Accepted, returns { id, status: 'PENDING' }
 *   2. Poll getExport or listExports until status: 'COMPLETED'
 *   3. getDownloadUrl → returns presigned S3 URL
 */
import { baseApi } from '../../services/baseApi';

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface ExportRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  reportType: string;
  format: string;
  status: ExportStatus;
  lastError: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ExportDownloadResponse {
  downloadUrl: string;
  expiresAt: string;
}

interface OrgArgs {
  orgId: string;
}

export const exportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    requestExport: build.mutation<
      ExportRecord,
      OrgArgs & {
        projectId?: string | null;
        reportType: string;
        format?: string;
        filters?: Record<string, unknown>;
      }
    >({
      query: ({ orgId, projectId, reportType, format, filters }) => ({
        url: `/organizations/${orgId}/exports`,
        method: 'POST',
        body: { projectId, reportType, format, filters },
      }),
      transformResponse: (raw: { data: ExportRecord }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Export', id: orgId }],
    }),

    listExports: build.query<{ exports: ExportRecord[] }, OrgArgs>({
      query: ({ orgId }) => `/organizations/${orgId}/exports`,
      transformResponse: (raw: { data: ExportRecord[] }) => ({ exports: raw.data }),
      providesTags: (_r, _e, { orgId }) => [{ type: 'Export', id: orgId }],
    }),

    getExport: build.query<ExportRecord, OrgArgs & { exportId: string }>({
      query: ({ orgId, exportId }) => `/organizations/${orgId}/exports/${exportId}`,
      transformResponse: (raw: { data: ExportRecord }) => raw.data,
      providesTags: (_r, _e, { exportId }) => [{ type: 'Export', id: exportId }],
    }),

    getDownloadUrl: build.query<ExportDownloadResponse, OrgArgs & { exportId: string }>({
      query: ({ orgId, exportId }) => `/organizations/${orgId}/exports/${exportId}/download`,
      transformResponse: (raw: { data: ExportDownloadResponse }) => raw.data,
    }),

  }),
  overrideExisting: false,
});

export const {
  useRequestExportMutation,
  useListExportsQuery,
  useGetExportQuery,
  useGetDownloadUrlQuery,
} = exportApi;
