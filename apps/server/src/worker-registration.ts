import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { AUTH_QUEUES } from './modules/auth/auth.jobs.js';
import { ORG_QUEUES } from './modules/invitation/invitation.jobs.js';
import { registerAuthWorkers } from './modules/auth/auth.worker.js';
import { registerOrgWorkers } from './modules/invitation/invitation.worker.js';
import { registerProjectWorkers } from './modules/project/core/project.worker.js';
import { registerScheduleWorkers } from './modules/project/engine/schedule.worker.js';
import { registerComplianceWorkers } from './modules/project/compliance/expiry-scanner.worker.js';
import { registerExportWorkers } from './modules/reporting/exports/export.worker.js';

const logger = createLogger({ name: 'worker-registration' });

export async function registerWorkers(boss: PgBoss): Promise<void> {
  await registerAuthWorkers(boss);
  await registerOrgWorkers(boss);
  await registerProjectWorkers(boss);
  await registerScheduleWorkers(boss);
  await registerComplianceWorkers(boss);
  await registerExportWorkers(boss);

  await boss.schedule(AUTH_QUEUES.CLEANUP_EXPIRED_SESSIONS, '0 2 * * *', {});
  logger.info('Scheduled cleanup: expired sessions (daily 02:00 UTC)');
  await boss.schedule(AUTH_QUEUES.CLEANUP_EXPIRED_VERIFICATION_TOKENS, '15 2 * * *', {});
  logger.info('Scheduled cleanup: expired verification tokens (daily 02:15 UTC)');
  await boss.schedule(AUTH_QUEUES.CLEANUP_EXPIRED_PASSWORD_RESET_TOKENS, '30 2 * * *', {});
  logger.info('Scheduled cleanup: expired password reset tokens (daily 02:30 UTC)');
  await boss.schedule(ORG_QUEUES.EXPIRE_INVITATIONS, '0 * * * *', {});
  logger.info('Scheduled: invitation expiry check (hourly)');
}
