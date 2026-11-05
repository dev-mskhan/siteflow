// apps/server/src/modules/ai/ingestion/ingestion.worker.ts
//
// PgBoss worker that consumes document.uploaded and document.version_created
// outbox events and triggers the RAG ingestion pipeline.
//
// Observability: OTel spans + Pino only. NO Langfuse — this is not an agent run.

import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../../lib/queue/worker-factory.js';
import {
  DOCUMENT_QUEUES,
  type DocumentUploadedPayload,
} from '../../project/documents/document.jobs.js';
import { ingestDocumentVersion } from './ingestion.service.js';
import { getDb } from '../../../lib/db/index.js';
import { documents, documentVersions } from '@siteflow/database/schema';
import { and, eq } from 'drizzle-orm';

const logger = createLogger({ name: 'ai-ingestion-worker' });

async function resolveStorageKey(
  organizationId: string,
  documentId: string,
  versionNumber: number,
): Promise<{ storageKey: string; contentType: string; documentVersionId: string } | null> {
  const db = getDb();

  // Get the document version matching this version number
  const rows = await db
    .select({
      id: documentVersions.id,
      storageKey: documentVersions.storageKey,
      contentType: documentVersions.contentType,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.versionNumber, versionNumber),
        eq(documents.organizationId, organizationId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    documentVersionId: row.id,
    storageKey: row.storageKey,
    contentType: row.contentType,
  };
}

export async function registerIngestionWorker(boss: PgBoss): Promise<void> {
  // Handle both document.uploaded and document.version_created with the same handler
  for (const queueName of [DOCUMENT_QUEUES.UPLOADED, DOCUMENT_QUEUES.VERSION_CREATED]) {
    await registerWorker<DocumentUploadedPayload>(
      boss,
      {
        queue: queueName,
        concurrency: 3,
        timeoutSecs: 120,
        tenantIdExtractor: (data) => data.organizationId,
        tenantConcurrencyLimit: 2,
        tenantLeaseGroup: 'ai.ingestion',
      },
      async (job) => {
        const { organizationId, projectId, documentId, versionNumber } = job.data;

        logger.info({ organizationId, documentId, versionNumber }, 'Ingestion job started');

        const resolved = await resolveStorageKey(organizationId, documentId, versionNumber);
        if (!resolved) {
          logger.warn({ documentId, versionNumber }, 'Document version not found — skipping ingestion');
          return;
        }

        const result = await ingestDocumentVersion({
          organizationId,
          projectId,
          documentId,
          documentVersionId: resolved.documentVersionId,
          versionNumber,
          storageKey: resolved.storageKey,
          contentType: resolved.contentType,
        });

        logger.info(
          { documentId, versionNumber, ...result },
          'Ingestion job finished',
        );
      },
    );
  }

  logger.info('Registered AI ingestion workers for document.uploaded and document.version_created');
}
