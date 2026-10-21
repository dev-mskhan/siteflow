// apps/server/src/modules/ai/workers/reaper.worker.ts
// AI Reaper Job:
//   1. Marks PENDING approvals past expiresAt as EXPIRED
//   2. Fails RUNNING runs whose workers died (> 10 minutes inactive)
//   3. Fails QUEUED runs that were never picked up (> 2 hours old)

import type PgBoss from 'pg-boss';
import { getDb } from '../../../lib/db/index.js';
import { createLogger } from '@siteflow/observability/server';
import { agentApprovals, agentRuns } from '@siteflow/database/schema';
import { eq, and, lt } from 'drizzle-orm';

const logger = createLogger({ name: 'ai-reaper' });

export const REAPER_QUEUE = 'ai:reaper';

export async function expireApprovals(): Promise<number> {
  const db = getDb();
  const result = await db
    .update(agentApprovals)
    .set({ status: 'EXPIRED', updatedAt: new Date() })
    .where(
      and(
        eq(agentApprovals.status, 'PENDING'),
        lt(agentApprovals.expiresAt, new Date()),
      ),
    )
    .returning({ id: agentApprovals.id });

  return result.length;
}

export async function failHungRunningRuns(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const result = await db
    .update(agentRuns)
    .set({
      status: 'FAILED',
      error: 'Run timed out: worker died or was terminated',
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agentRuns.status, 'RUNNING'),
        lt(agentRuns.updatedAt, cutoff),
      ),
    )
    .returning({ id: agentRuns.id });

  return result.length;
}

export async function failStaleQueuedRuns(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const result = await db
    .update(agentRuns)
    .set({
      status: 'FAILED',
      error: 'Run timed out: job was never claimed by a worker',
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agentRuns.status, 'QUEUED'),
        lt(agentRuns.createdAt, cutoff),
      ),
    )
    .returning({ id: agentRuns.id });

  return result.length;
}

export async function runReaperSweep(): Promise<{
  expiredApprovals: number;
  hungRunsFailed: number;
  staleQueuedFailed: number;
}> {
  const [expiredApprovals, hungRunsFailed, staleQueuedFailed] = await Promise.all([
    expireApprovals(),
    failHungRunningRuns(),
    failStaleQueuedRuns(),
  ]);

  logger.info(
    { expiredApprovals, hungRunsFailed, staleQueuedFailed },
    'AI reaper sweep completed',
  );

  return { expiredApprovals, hungRunsFailed, staleQueuedFailed };
}

export async function registerAiReaperWorker(boss: PgBoss): Promise<void> {
  // Run every 5 minutes
  await boss.schedule(REAPER_QUEUE, '*/5 * * * *', {});
  logger.info('Scheduled AI reaper: every 5 minutes (*/5 * * * *)');

  await boss.work(
    REAPER_QUEUE,
    async () => {
      try {
        await runReaperSweep();
      } catch (err) {
        logger.error({ err }, 'AI reaper sweep failed');
      }
    },
  );
}
