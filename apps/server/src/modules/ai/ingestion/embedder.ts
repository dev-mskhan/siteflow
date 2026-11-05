// apps/server/src/modules/ai/ingestion/embedder.ts
//
// Jina embeddings client — wraps the Jina AI REST API for batch embedding.
// Model: jina-embeddings-v3, 1024 dims, task-specific LoRA adapters.
//
// Ingestion uses task="retrieval.passage" (documents being indexed).
// Search uses task="retrieval.query" (user queries being searched).

import { serverEnv } from '../../../config/env.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'ai-embedder' });

const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';
const BATCH_SIZE = 128; // chunks per API call — Jina supports up to 2048 but 128 is safe

export type EmbeddingTask = 'retrieval.passage' | 'retrieval.query';

interface JinaEmbeddingResponse {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Embed a batch of texts using Jina AI.
 * Returns an array of 1024-dim float vectors in the same order as the input.
 */
async function embedBatch(
  texts: string[],
  task: EmbeddingTask,
  apiKey: string,
  model: string,
): Promise<number[][]> {
  const body = JSON.stringify({
    model,
    task,
    normalized: true,
    input: texts.map((text) => ({ text })),
  });

  const response = await fetch(JINA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    throw new Error(`Jina API error ${response.status}: ${errorText}`);
  }

  const result = (await response.json()) as JinaEmbeddingResponse;

  // Sort by index to guarantee order matches input
  const sorted = result.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * Embed an array of texts in batches of BATCH_SIZE.
 * Returns float[] arrays (1024 dims) in the same order as input.
 */
export async function embedTexts(
  texts: string[],
  task: EmbeddingTask = 'retrieval.passage',
): Promise<number[][]> {
  const apiKey = serverEnv.JINA_API_KEY;
  if (!apiKey) throw new Error('JINA_API_KEY not set — cannot embed documents');

  const model = serverEnv.JINA_EMBEDDING_MODEL ?? 'jina-embeddings-v3';

  if (texts.length === 0) return [];

  const results: number[][] = new Array(texts.length);
  let totalTokens = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchVectors = await embedBatch(batch, task, apiKey, model);

    for (let j = 0; j < batchVectors.length; j++) {
      results[i + j] = batchVectors[j]!;
    }

    logger.debug(
      { batchStart: i, batchSize: batch.length, task },
      'Embedded batch',
    );
  }

  logger.info({ count: texts.length, task, model }, 'Embedding complete');

  return results;
}

/**
 * Embed a single query string for search.
 * Uses task="retrieval.query" for optimal query-document matching.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const vectors = await embedTexts([query], 'retrieval.query');
  const vec = vectors[0];
  if (!vec) throw new Error('Embedding returned empty result');
  return vec;
}
