// apps/server/src/worker.ts — PgBoss worker process entry point
//
// ⚠️  OTEL is bootstrapped via --import @siteflow/observability/server/register
//     in the dev:worker/start:worker scripts.
import { createLogger } from '@siteflow/observability/server';
import { startQueue, stopQueue } from './lib/queue/index.js';
import { outboxService } from './lib/outbox/outbox.service.js';
import { registerWorkers } from './worker-registration.js';

const logger = createLogger({ name: 'worker' });

async function runWorker() {
  const boss = await startQueue();
  await registerWorkers(boss);

  // ─── Start Outbox Listener & Poller ─────────────────────────────────────────
  // Worker exclusively owns outbox processing — API only writes to outbox_events.
  outboxService.startPoller({
    minIntervalMs: 30000,
    maxIntervalMs: 60000,
    backoffMultiplier: 1.5,
  });

  logger.info('PgBoss worker process ready — listening for jobs');
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
