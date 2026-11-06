// apps/server/src/modules/ai/memory/memory-cleanup.worker.ts
//
// Weekly cleanup job for expired memory items.
// Runs via PgBoss cron schedule.

import type PgBoss from 'pg-boss';
import { getRedis } from '../../../lib/redis/redis.js';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../../lib/queue/worker-factory.js';

const logger = createLogger({ name: 'memory-cleanup-worker' });

export const MEMORY_CLEANUP_JOB = 'ai.memory.cleanup';

export interface MemoryCleanupPayload {
  dryRun?: boolean;
}

/**
 * Cleanup expired memory items.
 * Redis handles TTL automatically, so this is a safety net for edge cases.
 */
async function handleMemoryCleanup(job: PgBoss.Job<MemoryCleanupPayload>): Promise<void> {
  const { dryRun = false } = job.data;
  
  logger.info({ jobId: job.id, dryRun }, 'Memory cleanup job started');

  const redis = getRedis();
  const pattern = 'memory:*';
  
  try {
    let cursor = '0';
    let scanned = 0;
    let expired = 0;
    let batches = 0;
    const maxBatches = 10_000;

    do {
      if (batches >= maxBatches) {
        throw new Error(`Memory cleanup exceeded ${maxBatches} batches`);
      }

      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      batches++;
      scanned += keys.length;

      // Check TTL for each key
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        
        // ttl = -2 means key doesn't exist (already expired)
        // ttl = -1 means key has no expiry (shouldn't happen, but clean up)
        if (ttl === -2 || ttl === -1) {
          if (!dryRun) {
            await redis.del(key);
          }
          expired++;
        }
      }
    } while (cursor !== '0');

    logger.info(
      { jobId: job.id, scanned, expired, dryRun },
      'Memory cleanup job completed',
    );
  } catch (err) {
    logger.error({ err, jobId: job.id }, 'Memory cleanup job failed');
    throw err;
  }
}

export async function registerMemoryCleanupWorker(boss: PgBoss): Promise<void> {
  await registerWorker<MemoryCleanupPayload>(
    boss,
    {
      queue: MEMORY_CLEANUP_JOB,
      concurrency: 1,
      timeoutSecs: 600, // 10 minutes
    },
    handleMemoryCleanup,
  );

  // Weekly cron: Every Sunday at 2 AM UTC
  await boss.schedule(MEMORY_CLEANUP_JOB, '0 2 * * 0', {});

  logger.info('Memory cleanup worker registered (weekly cron)');
}
