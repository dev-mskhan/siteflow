// apps/server/src/worker.ts — PgBoss worker process entry point
//
// ⚠️  OTEL is bootstrapped via --import @siteflow/observability/server/register
//     in the dev:worker/start:worker scripts.
import { createLogger } from '@siteflow/observability/server';
import { startQueue, stopQueue } from './lib/queue/index.js';
import { AUTH_QUEUES } from './modules/auth/auth.jobs.js';
import { ORG_QUEUES } from './modules/invitation/invitation.jobs.js';

import { registerAuthWorkers } from './modules/auth/auth.worker.js';
import { registerOrgWorkers } from './modules/invitation/invitation.worker.js';

import { outboxService } from './lib/outbox/outbox.service.js';

const logger = createLogger({ name: 'worker' });

async function runWorker() {
  const boss = await startQueue();

  // ─── Register Auth workers ───────────────────────────────────────────────────
  await registerAuthWorkers(boss);

  // ─── Register Org workers ────────────────────────────────────────────────────
  await registerOrgWorkers(boss);

  // ─── Schedule cleanup jobs ───────────────────────────────────────────────────
  // Sessions: daily at 02:00 UTC
  await boss.schedule(AUTH_QUEUES.CLEANUP_EXPIRED_SESSIONS, '0 2 * * *', {});
  logger.info('Scheduled cleanup: expired sessions (daily 02:00 UTC)');

  // Verification tokens: daily at 02:15 UTC
  await boss.schedule(AUTH_QUEUES.CLEANUP_EXPIRED_VERIFICATION_TOKENS, '15 2 * * *', {});
  logger.info('Scheduled cleanup: expired verification tokens (daily 02:15 UTC)');

  // Password reset tokens: daily at 02:30 UTC
  await boss.schedule(AUTH_QUEUES.CLEANUP_EXPIRED_PASSWORD_RESET_TOKENS, '30 2 * * *', {});
  logger.info('Scheduled cleanup: expired password reset tokens (daily 02:30 UTC)');

  // Invitation expiry: every hour at :00
  await boss.schedule(ORG_QUEUES.EXPIRE_INVITATIONS, '0 * * * *', {});
  logger.info('Scheduled: invitation expiry check (hourly)');

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
