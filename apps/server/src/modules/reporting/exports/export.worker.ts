// apps/server/src/modules/reporting/exports/export.worker.ts
// F.17B — Idempotent PgBoss export generation and cleanup worker.

import type PgBoss from 'pg-boss';
import { registerWorker } from '../../../lib/queue/worker-factory.js';
import { EXPORT_QUEUES, type ExportGeneratePayload, type ExportCleanupPayload } from './export.jobs.js';
import { exportRepository } from './export.repository.js';
import { reportService } from '../report.service.js';
import { CsvReportRenderer } from './csv.renderer.js';
import { MinioStorageService } from '../../../lib/storage/storage.service.js';
import { exportService } from './export.service.js';
import type { ReportResultEnvelope } from '@siteflow/shared';

const storage = new MinioStorageService();

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
      const { exportId, organizationId, projectId, reportType, filterSnapshot } = job.data;
      
      const record = await exportRepository.findById(exportId, organizationId);
      if (!record || record.status === 'READY' || record.status === 'EXPIRED') {
        return; // Idempotent skip if already ready or expired
      }

      try {
        await exportRepository.markProcessing(exportId);
        const envelope = await fetchReport(organizationId, projectId, reportType, filterSnapshot);
        if (!envelope) {
          await exportRepository.markFailed(exportId, 'Report data not found or inaccessible');
          return;
        }

        const renderer = new CsvReportRenderer();
        const rendered = renderer.render(envelope);
        const safeOrg = organizationId.replace(/[^a-z0-9-]/gi, '');
        const objectKey = `exports/${safeOrg}/${exportId}.csv`;

        await uploadToMinio(objectKey, rendered.content);
        await exportRepository.markReady(exportId, objectKey);
      } catch (err: any) {
        await exportRepository.markFailed(exportId, err?.message ?? 'Export generation failed');
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
