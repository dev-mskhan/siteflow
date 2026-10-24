/**
 * exportApi — Report CSV exports.
 * Backend: apps/server/src/modules/reporting/exports/export.routes.ts
 *   POST   /:orgId/exports              — request export (202 Accepted)
 *   GET    /:orgId/exports              — list user's exports
 *   GET    /:orgId/exports/:exportId    — get status
 *   GET    /:orgId/exports/:exportId/download — get presigned download URL
 * Permission: project:read for all routes.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

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

const MOCK_EXPORTS: ExportRecord[] = [];

export const exportApi = createApi({
  reducerPath: 'exportApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Export'],
  endpoints: (build) => ({

    requestExport: build.mutation<ExportRecord, { orgId: string; projectId?: string | null; reportType: string; format?: string; filters?: Record<string, unknown> }>({
      queryFn: async ({ orgId, projectId, reportType }) => {
        await delay(250);
        const now = new Date().toISOString();
        const expires = new Date();
        expires.setHours(expires.getHours() + 24);
        const record: ExportRecord = {
          id: `exp_${Date.now()}`,
          organizationId: orgId,
          projectId: projectId ?? null,
          reportType,
          format: 'csv',
          status: 'COMPLETED',
          lastError: null,
          expiresAt: expires.toISOString(),
          createdAt: now,
        };
        MOCK_EXPORTS.unshift(record);
        return { data: record };
      },
      invalidatesTags: ['Export'],
    }),

    listExports: build.query<{ exports: ExportRecord[] }, { orgId: string }>({
      queryFn: async () => {
        await delay(120);
        return { data: { exports: MOCK_EXPORTS } };
      },
      providesTags: ['Export'],
    }),

    getExportStatus: build.query<ExportRecord, { orgId: string; exportId: string }>({
      queryFn: async ({ exportId }) => {
        await delay(100);
        const record = MOCK_EXPORTS.find((e) => e.id === exportId);
        if (!record) return { error: { status: 404, error: 'EXPORT_NOT_FOUND' } };
        return { data: record };
      },
      providesTags: (_r, _e, { exportId }) => [{ type: 'Export', id: exportId }],
    }),

    getExportDownloadUrl: build.query<{ downloadUrl: string; expiresIn: number }, { orgId: string; exportId: string }>({
      queryFn: async ({ exportId }) => {
        await delay(100);
        const record = MOCK_EXPORTS.find((e) => e.id === exportId);
        if (!record || record.status !== 'COMPLETED') return { error: { status: 404, error: 'EXPORT_NOT_READY' } };
        return { data: { downloadUrl: `https://mock-s3.example.com/exports/${exportId}.csv?expires=3600`, expiresIn: 3600 } };
      },
    }),
  }),
});

export const {
  useRequestExportMutation,
  useListExportsQuery,
  useGetExportStatusQuery,
  useGetExportDownloadUrlQuery,
} = exportApi;
