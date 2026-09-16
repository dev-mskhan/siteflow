// apps/server/src/lib/queue/queue.ts
import PgBoss from 'pg-boss';
import { serverEnv } from '../../config/env.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'pg-boss-queue' });

// ─── Queue job names ─────────────────────────────────────────────────────────
export const QUEUES = {
  EMAIL_SEND: 'email:send',
  RESOURCE_EXPORT: 'resource:export',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// ─── Job payloads ────────────────────────────────────────────────────────────
export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

export interface ExportPayload {
  resourceType: string;
  resourceId: string;
  format: 'csv' | 'pdf';
  requestedBy: string;
}

export type JobPayloads = {
  [QUEUES.EMAIL_SEND]: SendEmailPayload;
  [QUEUES.RESOURCE_EXPORT]: ExportPayload;
};

let _bossInstance: PgBoss | undefined;

/**
 * Gets or creates the singleton PgBoss queue instance.
 * Standardized to store queue tables in the 'app' database schema.
 */
export function getQueueInstance(): PgBoss {
  if (!_bossInstance) {
    _bossInstance = new PgBoss({
      connectionString: serverEnv.DATABASE_URL,
      schema: 'app',
      deleteAfterDays: 7,
      archiveCompletedAfterSeconds: 3600 * 24,
    });

    _bossInstance.on('error', (err) => {
      logger.error({ err }, 'PgBoss queue error occurred');
    });
  }
  return _bossInstance;
}

/**
 * Initializes and starts the PgBoss background job queue.
 */
export async function startQueue(): Promise<PgBoss> {
  const boss = getQueueInstance();
  await boss.start();
  logger.info('PgBoss queue started successfully in schema "app"');
  return boss;
}

/**
 * Gracefully stops the PgBoss queue worker and flushes pending operations.
 */
export async function stopQueue(): Promise<void> {
  if (_bossInstance) {
    await _bossInstance.stop();
    logger.info('PgBoss queue stopped cleanly');
    _bossInstance = undefined;
  }
}

/**
 * Enqueues a job with typed payload.
 */
export async function sendJob<N extends keyof JobPayloads>(
  name: N,
  data: JobPayloads[N],
  options?: PgBoss.SendOptions,
): Promise<string | null> {
  const boss = getQueueInstance();
  return options
    ? boss.send(name, data as object, options)
    : boss.send(name, data as object);
}
