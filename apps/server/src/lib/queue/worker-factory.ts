// apps/server/src/lib/queue/worker-factory.ts
import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { acquireTenantJobLease, releaseTenantJobLease } from './tenantJobLimit.js';

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
  /** maximum simultaneous jobs for the same tenant on this queue */
  tenantConcurrencyLimit?: number;
  /** share tenant concurrency across related queue names */
  tenantLeaseGroup?: string;
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
  const {
    queue,
    concurrency = 5,
    timeoutSecs = 60,
    tenantIdExtractor,
    tenantConcurrencyLimit = 50,
    tenantLeaseGroup = queue,
  } = opts;

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

      let tenantLease: { key: string; token: string } | undefined;
      try {
        if (tenantId) {
          while (!tenantLease) {
            tenantLease = await acquireTenantJobLease(
              tenantLeaseGroup,
              tenantId,
              tenantConcurrencyLimit,
              (timeoutSecs + 60) * 1000,
            ) ?? undefined;
            if (!tenantLease) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          }
        }
        await handler(job);
        logger.info({ queue, jobId, tenantId }, 'Job completed');
      } catch (err) {
        logger.error({ queue, jobId, tenantId, err }, 'Job failed');
        throw err; // re-throw so pg-boss handles retry / dead-letter
      } finally {
        if (tenantLease) await releaseTenantJobLease(tenantLease);
      }
    },
  );
}
