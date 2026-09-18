// apps/server/src/lib/queue/worker-factory.ts
import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { canStartJob, incrementJobCount } from './tenantJobLimit.js';

const logger = createLogger({ name: 'worker-factory' });

export interface WorkerOptions {
  /** pg-boss queue name */
  queue: string;
  /** max parallel jobs for this worker */
  concurrency?: number;
  /** max time a job may run before pg-boss marks it failed (seconds) */
  timeoutSecs?: number;
  /** used to enforce per-tenant quotas */
  tenantIdExtractor?: (data: any) => string | undefined;
}

/**
 * Registers a reliable pg-boss worker with:
 *   - retry with exponential backoff + jitter (configured in pg-boss queue options)
 *   - explicit timeout
 *   - concurrency cap
 *   - tenant-quota check before execution
 *   - structured logging on every state transition
 */
export async function registerWorker<T extends object>(
  boss: PgBoss,
  opts: WorkerOptions,
  handler: (job: PgBoss.Job<T>) => Promise<void>,
): Promise<void> {
  const { queue, concurrency = 5, timeoutSecs = 60, tenantIdExtractor } = opts;

  await boss.work<T>(
    queue,
    {
      teamSize: concurrency,
      teamConcurrency: concurrency,
      expireInSeconds: timeoutSecs,
    } as any,
    async (jobOrJobs) => {
      const job = Array.isArray(jobOrJobs) ? jobOrJobs[0] : jobOrJobs;
      if (!job) return;

      const jobId = job.id;
      const tenantId = tenantIdExtractor?.(job.data);
      logger.info({ queue, jobId, tenantId, attempt: job.retryCount }, 'Job started');

      try {
        // Tenant quota enforcement
        if (tenantId) {
          if (!(await canStartJob(tenantId))) {
            logger.warn({ queue, jobId, tenantId }, 'Tenant quota exceeded — deferring job');
            throw new Error(`Tenant quota exceeded for ${tenantId}`);
          }
          await incrementJobCount(tenantId);
        }

        await handler(job);
        logger.info({ queue, jobId, tenantId }, 'Job completed');
      } catch (err) {
        logger.error({ queue, jobId, tenantId, err }, 'Job failed');
        throw err; // re-throw so pg-boss handles retry / dead-letter
      }
    },
  );
}
