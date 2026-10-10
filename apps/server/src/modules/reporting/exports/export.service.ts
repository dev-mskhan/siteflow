// apps/server/src/modules/reporting/exports/export.service.ts
// F.17B — Export lifecycle service: sync/async decision, authorization, and download URL generation.
// Configurable D-03 defaults: 24h artifact retention, 5min signed URL expiry.

import { reportService } from '../report.service.js';
import { CsvReportRenderer } from './csv.renderer.js';
import { exportRepository } from './export.repository.js';
import { sendJob } from '../../../lib/queue/queue.js';
import { MinioStorageService } from '../../../lib/storage/storage.service.js';
import type { ReportResultEnvelope } from '@siteflow/shared';
import type { ReportExportRecord } from '@siteflow/database/schema';
import { serverEnv } from '../../../config/env.js';
import type { PortfolioActor } from '../report.service.js';
import { ProjectRepository } from '../../project/core/project.repository.js';
import { projectPolicy } from '../../project/core/project.policy.js';
import { ProjectNotFoundError } from '../../project/core/project.errors.js';
import { auditService } from '../../audit/audit.service.js';
import type { ProjectRole } from '../../project/core/project.types.js';

export const SIGNED_URL_EXPIRY_SECONDS = serverEnv.REPORT_EXPORT_SIGNED_URL_EXPIRY_SECONDS;

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
  portfolioActor: PortfolioActor | null;
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
  portfolioActor: PortfolioActor | null,
): Promise<ReportResultEnvelope | null> {
  const filters = filterSnapshot;
  switch (reportType) {
    case 'PROJECT_HEALTH':
      return reportService.getHealthReport(organizationId, projectId!) as any;
    case 'SCHEDULE_VARIANCE_PROGRESS':
      return reportService.getScheduleReport(organizationId, projectId!, filters);
    case 'COMMERCIAL_FINANCIAL_SUMMARY':
      return reportService.getCostReport(organizationId, projectId!, filters);
    case 'SUBCONTRACTOR_PERFORMANCE':
      return reportService.getSubcontractorReport(organizationId, projectId!, filters);
    case 'ORGANIZATION_PORTFOLIO':
      if (!portfolioActor) {
        throw new Error('Authenticated organization actor is required for portfolio exports');
      }
      return reportService.getPortfolioReport(organizationId, portfolioActor, filters);
    case 'PROJECT_EXECUTIVE_SUMMARY':
      return reportService.getExecutiveSummaryReport(organizationId, projectId!, filters);
    default:
      return null;
  }
}

export class ExportService {
  private readonly projectRepository = new ProjectRepository();

  async assertProjectRead(
    organizationId: string,
    projectId: string,
    actor: PortfolioActor,
  ): Promise<void> {
    const result = await this.projectRepository.findByIdWithMembership(
      organizationId,
      projectId,
      actor.userId,
    );
    if (!result) throw new ProjectNotFoundError();
    projectPolicy.authorize({
      actor: {
        organizationId,
        projectId,
        userId: actor.userId,
        organizationMembership: actor.organizationMembership,
        projectMembership: result.membership
          ? {
              id: result.membership.id,
              role: result.membership.role as ProjectRole,
              status: result.membership.status as 'ACTIVE' | 'REMOVED',
            }
          : null,
      },
      action: 'project:read',
    });
  }

  /**
   * Sync eligibility is decided from validated configuration before report work
   * starts; a slow fetch is never repeated by an async fallback.
   */
  async requestExport(params: {
    organizationId: string;
    projectId: string | null;
    requestedBy: string;
    reportType: string;
    filterSnapshot: Record<string, unknown>;
    portfolioActor: PortfolioActor | null;
  }): Promise<{ exportId: string; status: string; synchronous: boolean }> {
    if (params.reportType === 'ORGANIZATION_PORTFOLIO') {
      if (params.projectId !== null || !params.portfolioActor) {
        throw new Error('Organization portfolio export must use organization scope');
      }
    } else {
      if (!params.projectId || !params.portfolioActor) {
        throw new Error('Project export requires project scope and an authenticated actor');
      }
      await this.assertProjectRead(params.organizationId, params.projectId, params.portfolioActor);
    }

    const record = await exportRepository.create(params);
    await auditService.log({
      organizationId: params.organizationId,
      actorUserId: params.requestedBy,
      action: 'report.export.requested',
      resourceType: 'ReportExport',
      resourceId: record.id,
      projectId: params.projectId,
      metadata: { reportType: params.reportType, format: record.format },
    });
    const canRunSynchronously = serverEnv.REPORT_EXPORT_SYNC_REPORT_TYPES.some(
      (reportType) => reportType === params.reportType,
    );

    if (canRunSynchronously) {
      try {
        const envelope = await fetchReport(
          params.organizationId,
          params.projectId,
          params.reportType,
          params.filterSnapshot,
          params.portfolioActor,
        );
        if (!envelope) {
          throw new Error(`Report data unavailable for ${params.reportType}`);
        }

        const renderer = new CsvReportRenderer();
        const rendered = renderer.render(envelope);
        const objectKey = makeObjectKey(params.organizationId, record.id, 'csv');
        await uploadToMinio(objectKey, rendered.content);
        await exportRepository.markReady(
          record.id,
          record.organizationId,
          record.projectId,
          objectKey,
        );
        return { exportId: record.id, status: 'READY', synchronous: true };
      } catch (err) {
        await exportRepository.markFailed(
          record.id,
          record.organizationId,
          record.projectId,
          err instanceof Error ? err.message : String(err),
        );
        throw err;
      }
    }

    await exportRepository.markProcessing(record.id, record.organizationId, record.projectId);
    await sendJob(EXPORT_JOB_NAME, {
      exportId: record.id,
      organizationId: params.organizationId,
      projectId: params.projectId,
      reportType: params.reportType,
      filterSnapshot: params.filterSnapshot,
      portfolioActor: params.portfolioActor,
    });

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
    actor: PortfolioActor,
  ): Promise<ReportExportRecord | null> {
    const record = await exportRepository.findById(exportId, organizationId);
    if (!record) return null;
    // Enforce owner check
    if (record.requestedBy !== requestedBy) return null;
    if (record.projectId) {
      await this.assertProjectRead(organizationId, record.projectId, actor);
    }
    // Auto-expire if past expiresAt
    if (record.status === 'READY' && new Date(record.expiresAt) < new Date()) {
      await exportRepository.markExpired(exportId, record.organizationId, record.projectId);
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
    actor: PortfolioActor,
  ): Promise<{ downloadUrl: string } | null> {
    const record = await this.getExportStatus(exportId, organizationId, requestedBy, actor);
    if (!record || record.status !== 'READY' || !record.objectKey) return null;

    const downloadUrl = await storage.getPresignedUrl(record.objectKey, SIGNED_URL_EXPIRY_SECONDS);
    await auditService.log({
      organizationId: record.organizationId,
      actorUserId: requestedBy,
      action: 'report.export.downloaded',
      resourceType: 'ReportExport',
      resourceId: record.id,
      projectId: record.projectId,
      metadata: { reportType: record.reportType, format: record.format },
    });
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
        await exportRepository.markExpired(record.id, record.organizationId, record.projectId);
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
