import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../lib/queue/worker-factory.js';
import { listOrganizationsWithDueReminders } from './reminder-delivery.repository.js';
import { dispatchDueGraceReminders } from './lifecycle.service.js';

const logger = createLogger({ name: 'billing-lifecycle-worker' });

import { BILLING_LIFECYCLE_QUEUE } from './billing.jobs.js';
export { BILLING_LIFECYCLE_QUEUE };
export const BILLING_LIFECYCLE_CRON = '*/15 * * * *';
export const BILLING_LIFECYCLE_SCHEDULE_ID = 'siteflow-billing-grace-reminder-dispatch-v1';
const ORG_CONCURRENCY = 4;

/** Sweeps every tenant with lifecycle work. Each org is isolated so one failure cannot block others. */
export async function runLifecycleSweep(): Promise<{ organizations: number; failedOrganizations: number }> {
  const organizationIds = await listOrganizationsWithDueReminders();
  let failedOrganizations = 0;

  for (let i = 0; i < organizationIds.length; i += ORG_CONCURRENCY) {
    const chunk = organizationIds.slice(i, i + ORG_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((organizationId) => dispatchDueGraceReminders(organizationId)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedOrganizations += 1;
        logger.error(
          { organizationId: chunk[index], errorName: result.reason instanceof Error ? result.reason.name : 'unknown' },
          'billing lifecycle dispatch failed for organization',
        );
      }
    });
  }

  logger.info({ organizations: organizationIds.length, failedOrganizations }, 'billing lifecycle sweep completed');
  return { organizations: organizationIds.length, failedOrganizations };
}

export async function registerLifecycleWorker(boss: PgBoss): Promise<void> {
  await boss.createQueue(BILLING_LIFECYCLE_QUEUE, {
    name: BILLING_LIFECYCLE_QUEUE,
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
  });
  await registerWorker<Record<string, never>>(
    boss,
    {
      queue: BILLING_LIFECYCLE_QUEUE,
      concurrency: 1,
      timeoutSecs: 900,
    },
    async () => {
      await runLifecycleSweep();
    },
  );

  await boss.schedule(
    BILLING_LIFECYCLE_QUEUE,
    BILLING_LIFECYCLE_CRON,
    {},
    {
      singletonKey: BILLING_LIFECYCLE_SCHEDULE_ID,
      retryLimit: 2,
      retryDelay: 60,
      retryBackoff: true,
    },
  );
  logger.info(
    { scheduleId: BILLING_LIFECYCLE_SCHEDULE_ID, cron: BILLING_LIFECYCLE_CRON, queue: BILLING_LIFECYCLE_QUEUE },
    'Scheduled billing grace reminder dispatch',
  );
}
