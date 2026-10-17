import type PgBoss from 'pg-boss';
import { eq } from 'drizzle-orm';
import { organizations } from '@siteflow/database/schema';
import { operationsRemindersService } from './operations-reminders.service.js';
import { createLogger } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { registerWorker } from '../../../lib/queue/worker-factory.js';

const logger = createLogger({ name: 'operations-reminders-worker' });

export const OPERATIONS_REMINDER_QUEUES = {
  SCAN: 'operations:reminders_scan',
} as const;

export interface OperationsRemindersJobData {
  organizationId?: string;
}

export async function processOperationsRemindersJob(
  data: OperationsRemindersJobData = {},
  service = operationsRemindersService,
): Promise<{ rfiCount: number; docCount: number }> {
  if (data.organizationId) {
    logger.info({ organizationId: data.organizationId }, 'Running operations reminders scan worker job');
    const rfiCount = await service.scanOverdueRFIs(data.organizationId);
    const docCount = await service.scanExpiringDocuments(data.organizationId);
    logger.info({ organizationId: data.organizationId, rfiCount, docCount }, 'Operations reminders scan completed');
    return { rfiCount, docCount };
  }

  logger.info('Running operations reminders scan for all active organizations');
  const db = getDb();
  const activeOrgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.status, 'ACTIVE'));

  let totalRfi = 0;
  let totalDoc = 0;
  for (const org of activeOrgs) {
    try {
      totalRfi += await service.scanOverdueRFIs(org.id);
      totalDoc += await service.scanExpiringDocuments(org.id);
    } catch (err) {
      logger.error({ organizationId: org.id, err }, 'Failed to scan operations reminders for organization');
    }
  }

  logger.info({ totalRfi, totalDoc, orgCount: activeOrgs.length }, 'Operations reminders full scan completed');
  return { rfiCount: totalRfi, docCount: totalDoc };
}

export async function registerOperationsRemindersWorker(boss: PgBoss): Promise<void> {
  await registerWorker<OperationsRemindersJobData>(
    boss,
    {
      queue: OPERATIONS_REMINDER_QUEUES.SCAN,
      concurrency: 1,
      timeoutSecs: 300,
      tenantIdExtractor: (data) => data.organizationId,
    },
    async (job) => {
      await processOperationsRemindersJob(job.data ?? {});
    },
  );
}
