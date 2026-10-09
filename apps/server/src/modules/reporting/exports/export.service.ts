// apps/server/src/modules/reporting/exports/export.service.ts
// F.17B — Export lifecycle service: sync/async decision, authorization, and download URL generation.
// Configurable D-03 defaults: 24h artifact retention, 5min signed URL expiry.

import { reportService } from '../report.service.js';
import { CsvReportRenderer } from './csv.renderer.js';
import { exportRepository } from './export.repository.js';
import { sendJob } from '../../../lib/queue/queue.js';
import { MinioStorageService } from '../../../lib/storage/storage.service.js';
import { generateId } from '../../../lib/id.js';
import type { ReportResultEnvelope } from '@siteflow/shared';
import type { ReportExportRecord } from '@siteflow/database/schema';

// D-03 configurable policy values
const SYNC_THRESHOLD_MS = 100; // exports under this are synchronous
export const SIGNED_URL_EXPIRY_SECONDS = 5 * 60; // 5 minutes

const storage = new MinioStorageService();

// Job name for PgBoss
export const EXPORT_JOB_NAME = 'reporting:export:generate';
export const EXPORT_CLEANUP_JOB_NAME = 'reporting:export:cleanup';

export interface ExportJobPayload {
  exportId: string;
  organizationId: string;
  projectId: string | null;
  reportType: string;
  filterSnapshot: Record<string, unknown>;
}

/** Generate a server-scoped MinIO object key (never exposed to client raw). */
function makeObjectKey(orgId: string, exportId: string, format: string): string {
  // Use a UUID sub-path so keys are unguessable
  const safeOrg = orgId.replace(/[^a-z0-9-]/gi, '');
  return `exports/${safeOrg}/${exportId}.${format}`;
}

/** Fetch the correct report envelope given reportType. */
async function fetchReport(
  organizationId: string,
  projectId: string | null,
  reportType: string,
  filterSnapshot: Record<string, unknown>,
): Promise<ReportResultEnvelope | null> {
  const filters = filterSnapshot;
  switch (reportType) {
    case 'PROJECT_HEALTH':
      return reportService.getHealthReport(organizationId, projectId!);
    case 'SCHEDULE_VARIANCE_PROGRESS':
      return reportService.getScheduleReport(organizationId, projectId!, filters);
    case 'COMMERCIAL_FINANCIAL_SUMMARY':
      return reportService.getCostReport(organizationId, projectId!, filters);
    case 'SUBCONTRACTOR_PERFORMANCE':
      return reportService.getSubcontractorReport(organizationId, projectId!, filters);
    case 'ORGANIZATION_PORTFOLIO':
      return reportService.getPortfolioReport(organizationId, filters);
    case 'PROJECT_EXECUTIVE_SUMMARY':
      return reportService.getExecutiveSummaryReport(organizationId, projectId!, filters);
    default:
      return null;
  }
}

export class ExportService {
  /**
   * Request a CSV export. Small exports are synchronous (< SYNC_THRESHOLD_MS),
   * larger ones are dispatched to PgBoss.
   */
  async requestExport(params: {
    organizationId: string;
    projectId: string | null;
    requestedBy: string;
    reportType: string;
    filterSnapshot: Record<string, unknown>;
  }): Promise<{ exportId: string; status: string; synchronous: boolean }> {
    // Create PENDING record
    const record = await exportRepository.create(params);

    // Try synchronous path — measure time
    const start = Date.now();
    let syncResult: { content: string; filename: string } | null = null;

    try {
      const envelope = await fetchReport(
        params.organizationId,
        params.projectId,
        params.reportType,
        params.filterSnapshot,
      );
      const elapsed = Date.now() - start;

      if (envelope && elapsed < SYNC_THRESHOLD_MS) {
        // Render synchronously
        const renderer = new CsvReportRenderer();
        const rendered = renderer.render(envelope);
        syncResult = { content: rendered.content, filename: rendered.filename };

        // Upload to MinIO and mark ready
        const objectKey = makeObjectKey(params.organizationId, record.id, 'csv');
        const { Readable } = await import('node:stream');
        const stream = Readable.from([Buffer.from(rendered.content, 'utf-8')]);
        // Use putPresignedUrl pattern — but since we're server-side writing, upload directly
        await uploadToMinio(objectKey, rendered.content);
        await exportRepository.markReady(record.id, objectKey);

        return { exportId: record.id, status: 'READY', synchronous: true };
      }
    } catch {
      // Fall through to async path
    }

    // Async path — enqueue PgBoss job
    await exportRepository.markProcessing(record.id);
    await sendJob(EXPORT_JOB_NAME, {
      exportId: record.id,
      organizationId: params.organizationId,
      projectId: params.projectId,
      reportType: params.reportType,
      filterSnapshot: params.filterSnapshot,
    } as ExportJobPayload);

    return { exportId: record.id, status: 'PROCESSING', synchronous: false };
  }

  /**
   * Get export status. Enforces organization + owner scope.
   * Returns null if not found or unauthorized.
   */
  async getExportStatus(
    exportId: string,
    organizationId: string,
    requestedBy: string,
  ): Promise<ReportExportRecord | null> {
    const record = await exportRepository.findById(exportId, organizationId);
    if (!record) return null;
    // Enforce owner check
    if (record.requestedBy !== requestedBy) return null;
    // Auto-expire if past expiresAt
    if (record.status === 'READY' && new Date(record.expiresAt) < new Date()) {
      await exportRepository.markExpired(exportId);
      return { ...record, status: 'EXPIRED', objectKey: null };
    }
    return record;
  }

  /**
   * Generate a fresh 5-minute presigned download URL.
   * Rechecks: organization scope, owner, READY status, and not expired.
   * Never returns raw object key to caller.
   */
  async getDownloadUrl(
    exportId: string,
    organizationId: string,
    requestedBy: string,
  ): Promise<{ downloadUrl: string } | null> {
    const record = await this.getExportStatus(exportId, organizationId, requestedBy);
    if (!record || record.status !== 'READY' || !record.objectKey) return null;

    const downloadUrl = await storage.getPresignedUrl(record.objectKey, SIGNED_URL_EXPIRY_SECONDS);
    return { downloadUrl };
  }

  /**
   * List the calling user's exports for an organization.
   */
  async listExports(organizationId: string, requestedBy: string): Promise<ReportExportRecord[]> {
    return exportRepository.listByUser(organizationId, requestedBy);
  }

  /**
   * Cleanup job: mark expired READY/PROCESSING records and delete their MinIO objects.
   * Idempotent — safe to re-run.
   */
  async cleanupExpired(): Promise<{ cleaned: number }> {
    const expired = await exportRepository.findExpired();
    let cleaned = 0;
    for (const record of expired) {
      try {
        if (record.objectKey) {
          await storage.deleteObject(record.objectKey);
        }
        await exportRepository.markExpired(record.id);
        cleaned++;
      } catch {
        // Log but continue — idempotent
      }
    }
    return { cleaned };
  }
}

/** Upload CSV content to MinIO directly from server side. */
async function uploadToMinio(objectKey: string, content: string): Promise<void> {
  const { Client } = await import('minio');
  const { serverEnv } = await import('../../../config/env.js');
  const client = new Client({
    endPoint: serverEnv.MINIO_ENDPOINT,
    port: serverEnv.MINIO_PORT,
    useSSL: serverEnv.MINIO_USE_SSL,
    accessKey: serverEnv.MINIO_ACCESS_KEY,
    secretKey: serverEnv.MINIO_SECRET_KEY,
  });
  const buf = Buffer.from(content, 'utf-8');
  const { Readable } = await import('node:stream');
  const stream = Readable.from([buf]);
  await client.putObject(serverEnv.MINIO_BUCKET_DOCUMENTS, objectKey, stream, buf.length, {
    'Content-Type': 'text/csv; charset=utf-8',
  });
}

export const exportService = new ExportService();
