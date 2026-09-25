// apps/server/src/modules/auth/auth.worker.ts
import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../lib/queue/worker-factory.js';
import {
  AUTH_QUEUES,
  type SendEmailVerificationPayload,
  type SendPasswordResetPayload,
  type SendPasswordChangedPayload,
  type SendNewLoginPayload,
} from './auth.jobs.js';
import { AuthRepository } from './auth.repository.js';
import { emailService } from '../../lib/email/email.service.js';

const logger = createLogger({ name: 'auth-worker' });

export async function registerAuthWorkers(boss: PgBoss): Promise<void> {
  const repository = new AuthRepository();

  // 1. Send Email Verification
  await registerWorker<SendEmailVerificationPayload>(
    boss,
    { queue: AUTH_QUEUES.SEND_EMAIL_VERIFICATION, concurrency: 5, timeoutSecs: 30 },
    async (job) => {
      logger.info({ jobId: job.id, to: job.data.email }, 'Sending verification email');
      await emailService.sendEmailVerification(job.data.email, job.data.token);
    },
  );

  // 2. Send Password Reset
  await registerWorker<SendPasswordResetPayload>(
    boss,
    { queue: AUTH_QUEUES.SEND_PASSWORD_RESET, concurrency: 5, timeoutSecs: 30 },
    async (job) => {
      logger.info({ jobId: job.id, to: job.data.email }, 'Sending password reset email');
      await emailService.sendPasswordReset(job.data.email, job.data.token);
    },
  );

  // 3. Send Password Changed Notification
  await registerWorker<SendPasswordChangedPayload>(
    boss,
    { queue: AUTH_QUEUES.SEND_PASSWORD_CHANGED_NOTIFICATION, concurrency: 5, timeoutSecs: 30 },
    async (job) => {
      logger.info({ jobId: job.id, to: job.data.email }, 'Sending password changed notification');
      await emailService.sendPasswordChangedNotification(job.data.email);
    },
  );

  // 4. Send New Login Notification
  await registerWorker<SendNewLoginPayload>(
    boss,
    { queue: AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION, concurrency: 10, timeoutSecs: 30 },
    async (job) => {
      logger.info({ jobId: job.id, to: job.data.email }, 'Sending new login notification');
      await emailService.sendNewLoginNotification(
        job.data.email,
        job.data.ipAddress,
        job.data.userAgent,
      );
    },
  );

  // 5. Cleanup Expired Sessions (scheduled via boss.schedule in worker.ts)
  await registerWorker<Record<string, unknown>>(
    boss,
    { queue: AUTH_QUEUES.CLEANUP_EXPIRED_SESSIONS, concurrency: 1, timeoutSecs: 120 },
    async (_job) => {
      const count = await repository.cleanupExpiredSessions();
      logger.info({ deletedCount: count }, 'Cleaned up expired sessions');
    },
  );

  // 6. Cleanup Expired Verification Tokens (scheduled via boss.schedule in worker.ts)
  await registerWorker<Record<string, unknown>>(
    boss,
    { queue: AUTH_QUEUES.CLEANUP_EXPIRED_VERIFICATION_TOKENS, concurrency: 1, timeoutSecs: 60 },
    async (_job) => {
      const count = await repository.cleanupExpiredVerificationTokens();
      logger.info({ deletedCount: count }, 'Cleaned up expired verification tokens');
    },
  );

  // 7. Cleanup Expired Password Reset Tokens (scheduled via boss.schedule in worker.ts)
  await registerWorker<Record<string, unknown>>(
    boss,
    { queue: AUTH_QUEUES.CLEANUP_EXPIRED_PASSWORD_RESET_TOKENS, concurrency: 1, timeoutSecs: 60 },
    async (_job) => {
      const count = await repository.cleanupExpiredPasswordResetTokens();
      logger.info({ deletedCount: count }, 'Cleaned up expired password reset tokens');
    },
  );

  logger.info('Registered all Auth module PgBoss workers');
}
