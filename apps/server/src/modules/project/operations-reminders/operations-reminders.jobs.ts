import { sendJob } from '../../../lib/queue/queue.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'operations-reminders-jobs' });

export const OPERATIONS_REMINDERS_JOB_NAME = 'operations-reminders-scan';

export async function enqueueOperationsRemindersJob(organizationId: string): Promise<string | null> {
  if (!organizationId) {
    throw new Error('organizationId is required to enqueue operations reminders scan job');
  }

  logger.info({ organizationId }, 'Enqueuing operational reminders scan job');
  return sendJob(OPERATIONS_REMINDERS_JOB_NAME, { organizationId });
}
