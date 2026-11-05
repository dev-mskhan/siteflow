// apps/server/src/modules/ai/ingestion/ingestion.service.ts
//
// Orchestrates document ingestion into the RAG knowledge base.
//
// Pipeline:
//   1. Skip if chunks already ACTIVE for this documentVersionId (idempotent)
//   2. Download file from MinIO → extract text
//   3. Structure-aware chunk the text
//   4. Batch embed via Jina AI (task=retrieval.passage)
//   5. In one transaction: INSERT chunks + SUPERSEDE prior version chunks
//
// Observability: OTel spans + structured Pino logs. No Langfuse.

import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { knowledgeChunks } from '@siteflow/database/schema';
import { and, eq } from 'drizzle-orm';
import { generateId } from '../../../lib/id.js';
import { downloadBuffer } from '../../../lib/storage/storage.service.js';
import { chunkText } from './chunker.js';
import { embedTexts } from './embedder.js';

const logger = createLogger({ name: 'ai-ingestion' });
const tracer = trace.getTracer('ai-ingestion');

/**
 * Extract plain text from a Buffer based on content type.
 * Handles text/plain, text/markdown. PDF/DOCX deferred to WAVE 5.
 */
function extractText(buffer: Buffer, contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('text/') || ct.includes('markdown')) {
    return buffer.toString('utf-8');
  }
  logger.warn({ contentType }, 'Unsupported content type for text extraction — skipping');
  return '';
}

/**
 * Main entry point: ingest one document version into knowledge_chunks.
 * Idempotent: safe to call twice with the same documentVersionId.
 */
export async function ingestDocumentVersion(opts: {
  organizationId: string;
  projectId: string;
  documentId: string;
  documentVersionId: string;
  versionNumber: number;
  storageKey: string;
  contentType: string;
}): Promise<{ chunksInserted: number; skipped: boolean }> {
  const {
    organizationId, projectId, documentId, documentVersionId,
    versionNumber, storageKey, contentType,
  } = opts;

  return withSpan(tracer, 'ai.ingestion.document', async (span) => {
    span.setAttributes({ organizationId, projectId, documentId, documentVersionId, versionNumber });

    const db = getDb();

    // ── 1. Idempotency: skip if already ingested ───────────────────────────
    const existing = await db
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.documentVersionId, documentVersionId),
          eq(knowledgeChunks.organizationId, organizationId),
          eq(knowledgeChunks.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      logger.info({ documentVersionId }, 'Chunks already active — skipping ingestion');
      return { chunksInserted: 0, skipped: true };
    }

    // ── 2. Download from MinIO ─────────────────────────────────────────────
    let fileBuffer: Buffer;
    try {
      fileBuffer = await downloadBuffer(storageKey);
    } catch (err) {
      logger.warn({ storageKey, err }, 'Failed to download document — skipping ingestion');
      return { chunksInserted: 0, skipped: true };
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      logger.warn({ storageKey }, 'Empty file — skipping ingestion');
      return { chunksInserted: 0, skipped: true };
    }

    // ── 3. Extract text ────────────────────────────────────────────────────
    const text = extractText(fileBuffer, contentType);
    if (!text) {
      logger.info({ documentVersionId, contentType }, 'No text extracted — skipping');
      return { chunksInserted: 0, skipped: true };
    }

    // ── 4. Structure-aware chunk ───────────────────────────────────────────
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      logger.warn({ documentVersionId }, 'No chunks produced — skipping ingestion');
      return { chunksInserted: 0, skipped: true };
    }

    // ── 5. Batch embed (Jina AI) ───────────────────────────────────────────
    const texts = chunks.map((c) => c.content);
    const vectors = await embedTexts(texts, 'retrieval.passage');

    // ── 6. Atomic: supersede old + insert new chunks ───────────────────────
    await db.transaction(async (tx) => {
      // Mark any existing ACTIVE chunks for this document as SUPERSEDED
      await tx
        .update(knowledgeChunks)
        .set({ status: 'SUPERSEDED' })
        .where(
          and(
            eq(knowledgeChunks.documentId, documentId),
            eq(knowledgeChunks.organizationId, organizationId),
            eq(knowledgeChunks.status, 'ACTIVE'),
          ),
        );

      // Insert new chunks in sub-batches (avoids large parameter lists)
      const rows = chunks.map((chunk, i) => ({
        id: generateId(),
        organizationId,
        projectId,
        documentId,
        documentVersionId,
        versionNumber,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: vectors[i]!,
        pageReference: chunk.pageReference,
        status: 'ACTIVE' as const,
      }));

      const INSERT_BATCH = 50;
      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        await tx.insert(knowledgeChunks).values(rows.slice(i, i + INSERT_BATCH));
      }
    });

    logger.info({ documentVersionId, chunksInserted: chunks.length }, 'Document ingestion complete');
    span.setAttribute('chunks.inserted', chunks.length);
    return { chunksInserted: chunks.length, skipped: false };
  });
}
