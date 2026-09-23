// apps/server/src/worker.ts — PgBoss worker process entry point
//
// ⚠️  OTEL is bootstrapped via --import @siteflow/observability/server/register
//     in the dev:worker/start:worker scripts.
import { createLogger } from '@siteflow/observability/server';
import { startQueue, stopQueue, QUEUES, type SendEmailPayload, type ExportPayload } from './lib/queue/index.js';

import { registerAuthWorkers } from './modules/auth/auth.worker.js';
import { registerOrgWorkers } from './modules/invitation/invitation.worker.js';

import { outboxService } from './lib/outbox/outbox.service.js';
import type { Job } from 'pg-boss';

const logger = createLogger({ name: 'worker' });

async function runWorker() {
  const boss = await startQueue();

  // ─── Register Auth workers ───────────────────────────────────────────────────
  await registerAuthWorkers(boss);

  // ─── Register Org workers ────────────────────────────────────────────────────
  await registerOrgWorkers(boss);

  // ─── Start Outbox Listener & Poller (Worker exclusively owns outbox processing) ───
  outboxService.startPoller({
    minIntervalMs: 30000,
    maxIntervalMs: 60000,
    backoffMultiplier: 1.5,
  });

  // ─── Register worker for Send Email ─────────────────────────────────────────
  await boss.work(QUEUES.EMAIL_SEND, async (job: Job<SendEmailPayload> | Job<SendEmailPayload>[]) => {
    const item = Array.isArray(job) ? job[0] : job;
    if (!item) return;
    logger.info({ jobId: item.id, to: item.data.to, subject: item.data.subject }, 'Processing send email job');
    // Simulated work
    logger.info({ jobId: item.id }, 'Email job processed successfully');
  });

  // ─── Register worker for Resource Export ─────────────────────────────────────
  await boss.work(QUEUES.RESOURCE_EXPORT, async (job: Job<ExportPayload> | Job<ExportPayload>[]) => {
    const item = Array.isArray(job) ? job[0] : job;
    if (!item) return;
    logger.info({ jobId: item.id, resourceId: item.data.resourceId, format: item.data.format }, 'Processing resource export job');
    // Simulated work
    logger.info({ jobId: item.id }, 'Export job processed successfully');
  });

  logger.info('PgBoss worker registered and listening for jobs on queues');
}

runWorker().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});

const shutdown = async () => {
  logger.info('Worker shutting down…');
  await outboxService.stopPoller();
  await stopQueue();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
