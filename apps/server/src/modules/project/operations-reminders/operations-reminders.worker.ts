import { operationsRemindersService } from './operations-reminders.service.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'operations-reminders-worker' });

export interface OperationsRemindersJobData {
  organizationId: string;
}

export async function processOperationsRemindersJob(
  data: OperationsRemindersJobData,
  service = operationsRemindersService,
): Promise<{ rfiCount: number; docCount: number }> {
  if (!data.organizationId) {
    throw new Error('organizationId is required for operations reminders worker job');
  }

  logger.info({ organizationId: data.organizationId }, 'Running operations reminders scan worker job');

  const rfiCount = await service.scanOverdueRFIs(data.organizationId);
  const docCount = await service.scanExpiringDocuments(data.organizationId);

  logger.info({ organizationId: data.organizationId, rfiCount, docCount }, 'Operations reminders scan completed');
  return { rfiCount, docCount };
}
