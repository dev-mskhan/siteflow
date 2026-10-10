// apps/server/src/modules/reporting/exports/export.worker.ts
// F.17B — Idempotent PgBoss export generation and cleanup worker.

import type PgBoss from 'pg-boss';
import { registerWorker } from '../../../lib/queue/worker-factory.js';
import { EXPORT_QUEUES, type ExportGeneratePayload, type ExportCleanupPayload } from './export.jobs.js';
import { exportRepository } from './export.repository.js';
import { reportService } from '../report.service.js';
import { CsvReportRenderer } from './csv.renderer.js';
import { exportService } from './export.service.js';
import type { ReportResultEnvelope } from '@siteflow/shared';
import { rbacService } from '../../rbac/rbac.service.js';

async function fetchReport(
  organizationId: string,
  projectId: string | null,
  reportType: string,
  filterSnapshot: Record<string, unknown>,
  portfolioActor: ExportGeneratePayload['portfolioActor'],
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

export async function registerExportWorkers(boss: PgBoss): Promise<void> {
  // 1. Generation Worker
  await registerWorker<ExportGeneratePayload>(
    boss,
    {
      queue: EXPORT_QUEUES.GENERATE,
      concurrency: 5,
      timeoutSecs: 180,
      tenantIdExtractor: (data) => data.organizationId,
      tenantConcurrencyLimit: 5,
    },
    async (job) => {
      const { exportId, organizationId, projectId, reportType, filterSnapshot, portfolioActor } = job.data;
      
      const record = await exportRepository.findById(exportId, organizationId);
      if (!record || record.status === 'READY' || record.status === 'EXPIRED') {
        return; // Idempotent skip if already ready or expired
      }

      try {
        if (record.requestedBy !== portfolioActor?.userId) {
          throw new Error('Export job requester does not match the export record');
        }
        if (record.projectId !== projectId) {
          throw new Error('Export job project scope does not match the export record');
        }
        const currentMembership = await rbacService.getOrganizationContext(
          organizationId,
          record.requestedBy,
        );
        const currentActor = {
          userId: currentMembership.userId,
          organizationMembership: {
            id: currentMembership.membershipId,
            roleId: currentMembership.roleId,
            permissions: currentMembership.permissions,
          },
        };
        if (projectId) {
          await exportService.assertProjectRead(organizationId, projectId, currentActor);
        } else if (reportType !== 'ORGANIZATION_PORTFOLIO') {
          throw new Error('Project-scoped report requires a project ID');
        }
        await exportRepository.markProcessing(exportId, organizationId, record.projectId);
        const envelope = await fetchReport(
          organizationId,
          projectId,
          reportType,
          filterSnapshot,
          currentActor,
        );
        if (!envelope) {
          await exportRepository.markFailed(
            exportId,
            organizationId,
            record.projectId,
            'Report data not found or inaccessible',
          );
          return;
        }

        const completionMembership = await rbacService.getOrganizationContext(
          organizationId,
          record.requestedBy,
        );
        const completionActor = {
          userId: completionMembership.userId,
          organizationMembership: {
            id: completionMembership.membershipId,
            roleId: completionMembership.roleId,
            permissions: completionMembership.permissions,
          },
        };
        if (projectId) {
          await exportService.assertProjectRead(organizationId, projectId, completionActor);
        }

        const renderer = new CsvReportRenderer();
        const rendered = renderer.render(envelope);
        const safeOrg = organizationId.replace(/[^a-z0-9-]/gi, '');
        const objectKey = `exports/${safeOrg}/${exportId}.csv`;

        await uploadToMinio(objectKey, rendered.content);
        await exportRepository.markReady(exportId, organizationId, record.projectId, objectKey);
      } catch (err: any) {
        await exportRepository.markFailed(
          exportId,
          organizationId,
          record.projectId,
          err?.message ?? 'Export generation failed',
        );
        throw err;
      }
    },
  );

  // 2. Cleanup Worker
  await registerWorker<ExportCleanupPayload>(
    boss,
    {
      queue: EXPORT_QUEUES.CLEANUP,
      concurrency: 1,
      timeoutSecs: 300,
    },
    async () => {
      await exportService.cleanupExpired();
    },
  );

  // Schedule daily cleanup at 03:00 UTC
  await boss.schedule(EXPORT_QUEUES.CLEANUP, '0 3 * * *', {});
}
