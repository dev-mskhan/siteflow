import type PgBoss from 'pg-boss';
import { registerWorker } from '../../../lib/queue/worker-factory.js';
import { COMPLIANCE_QUEUES, type ExpiryScanJobPayload } from './compliance.jobs.js';
import { expiryScannerService } from './expiry-scanner.service.js';

export async function registerComplianceWorkers(boss: PgBoss): Promise<void> {
  await registerWorker<ExpiryScanJobPayload>(
    boss,
    {
      queue: COMPLIANCE_QUEUES.SCAN_EXPIRY,
      concurrency: 1,
      timeoutSecs: 300,
    },
    async () => {
      await expiryScannerService.scan();
    },
  );

  await boss.schedule(
    COMPLIANCE_QUEUES.SCAN_EXPIRY,
    '0 6 * * *',
    {},
    {
      singletonKey: COMPLIANCE_QUEUES.SCAN_EXPIRY,
      retryLimit: 2,
    },
  );
}
