// apps/server/src/lib/queue/queue.ts
import PgBoss from 'pg-boss';
import { serverEnv } from '../../config/env.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'pg-boss-queue' });

import {
  AUTH_QUEUES,
  type SendEmailVerificationPayload,
  type SendPasswordResetPayload,
  type SendPasswordChangedPayload,
  type SendNewLoginPayload,
} from '../../modules/auth/auth.jobs.js';

// ─── Queue job names ─────────────────────────────────────────────────────────
export const QUEUES = {
  EMAIL_SEND: 'email:send',
  RESOURCE_EXPORT: 'resource:export',
  ...AUTH_QUEUES,
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
  [AUTH_QUEUES.SEND_EMAIL_VERIFICATION]: SendEmailVerificationPayload;
  [AUTH_QUEUES.SEND_PASSWORD_RESET]: SendPasswordResetPayload;
  [AUTH_QUEUES.SEND_PASSWORD_CHANGED_NOTIFICATION]: SendPasswordChangedPayload;
  [AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION]: SendNewLoginPayload;
  [AUTH_QUEUES.CLEANUP_EXPIRED_SESSIONS]?: Record<string, unknown>;
  [AUTH_QUEUES.CLEANUP_EXPIRED_VERIFICATION_TOKENS]?: Record<string, unknown>;
  [AUTH_QUEUES.CLEANUP_EXPIRED_PASSWORD_RESET_TOKENS]?: Record<string, unknown>;
};

let _bossInstance: PgBoss | undefined;
let _startPromise: Promise<PgBoss> | undefined;

/**
 * Gets or creates the singleton PgBoss queue instance.
 * Standardized to store queue tables in the 'app' database schema.
 */
export function getQueueInstance(): PgBoss {
  if (!_bossInstance) {
    _bossInstance = new PgBoss({
      connectionString: serverEnv.DATABASE_URL,
      schema: 'pgboss',
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
 * Ensures start() is idempotent and called only once. Pre-creates all registered queues.
 */
export async function startQueue(): Promise<PgBoss> {
  const boss = getQueueInstance();
  if (!_startPromise) {
    _startPromise = boss
      .start()
      .then(async () => {
        logger.info('PgBoss queue started successfully in schema "pgboss"');
        // Pre-create all registered queues so workers can bind cleanly
        for (const queueName of Object.values(QUEUES)) {
          try {
            await boss.createQueue(queueName);
          } catch (err) {
            logger.debug({ queueName, err }, 'Queue creation notice');
          }
        }
        return boss;
      })
      .catch((err) => {
        logger.error({ err }, 'Failed to start PgBoss queue');
        _startPromise = undefined; // Allow retry on failure
        throw err;
      });
  }
  return _startPromise;
}

/**
 * Gracefully stops the PgBoss queue worker and flushes pending operations.
 */
export async function stopQueue(): Promise<void> {
  if (_bossInstance) {
    await _bossInstance.stop();
    logger.info('PgBoss queue stopped cleanly');
    _bossInstance = undefined;
    _startPromise = undefined;
  }
}

/**
 * Single strongly-typed sendJob function.
 * Accepts any registered queue name with auto-completed payload type,
 * while allowing runtime event strings for dynamic outbox dispatches.
 */
export async function sendJob<N extends keyof JobPayloads | (string & {})>(
  name: N,
  data: N extends keyof JobPayloads ? JobPayloads[N] : Record<string, unknown>,
  options?: PgBoss.SendOptions,
): Promise<string | null> {
  const boss = await startQueue();
  return options
    ? boss.send(name as string, data as object, options)
    : boss.send(name as string, data as object);
}

