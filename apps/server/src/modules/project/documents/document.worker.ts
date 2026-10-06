import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../../lib/queue/worker-factory.js';
import { DOCUMENT_QUEUES, type DocumentUploadedPayload } from './document.jobs.js';
import { DocumentService } from './document.service.js';

const logger = createLogger({ name: 'document-worker' });

export async function registerDocumentWorkers(boss: PgBoss): Promise<void> {
  const service = new DocumentService();
  const handler = async (job: PgBoss.Job<DocumentUploadedPayload>) => {
    const { organizationId, projectId, documentId, versionNumber } = job.data;
    await service.processUploadedVersion(organizationId, projectId, documentId, versionNumber);
    logger.info({ organizationId, projectId, documentId, versionNumber }, 'Document processing completed');
  };
  for (const queue of [DOCUMENT_QUEUES.UPLOADED, DOCUMENT_QUEUES.VERSION_CREATED]) {
    await registerWorker<DocumentUploadedPayload>(
      boss,
      {
        queue,
        concurrency: 1,
        timeoutSecs: 900,
        tenantIdExtractor: (data) => data.organizationId,
        tenantConcurrencyLimit: 1,
        tenantLeaseGroup: 'document-processing',
      },
      handler,
    );
  }
  logger.info('Registered isolated document processing worker');
}
