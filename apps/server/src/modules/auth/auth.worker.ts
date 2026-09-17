// apps/server/src/modules/auth/auth.worker.ts
import type PgBoss from 'pg-boss';
import type { Job } from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
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

  // 1. Send Email Verification Worker
  await boss.work(
    AUTH_QUEUES.SEND_EMAIL_VERIFICATION,
    async (job: Job<SendEmailVerificationPayload> | Job<SendEmailVerificationPayload>[]) => {
      const item = Array.isArray(job) ? job[0] : job;
      if (!item) return;
      logger.info({ jobId: item.id, to: item.data.email }, `Processing verification email for user ${item.data.userId}`);
      await emailService.sendEmailVerification(item.data.email, item.data.token);
    },
  );

  // 2. Send Password Reset Worker
  await boss.work(
    AUTH_QUEUES.SEND_PASSWORD_RESET,
    async (job: Job<SendPasswordResetPayload> | Job<SendPasswordResetPayload>[]) => {
      const item = Array.isArray(job) ? job[0] : job;
      if (!item) return;
      logger.info({ jobId: item.id, to: item.data.email }, `Processing password reset email for user ${item.data.userId}`);
      await emailService.sendPasswordReset(item.data.email, item.data.token);
    },
  );

  // 3. Send Password Changed Notification Worker
  await boss.work(
    AUTH_QUEUES.SEND_PASSWORD_CHANGED_NOTIFICATION,
    async (job: Job<SendPasswordChangedPayload> | Job<SendPasswordChangedPayload>[]) => {
      const item = Array.isArray(job) ? job[0] : job;
      if (!item) return;
      logger.info({ jobId: item.id, to: item.data.email }, `Processing password changed notification for user ${item.data.userId}`);
      await emailService.sendPasswordChangedNotification(item.data.email);
    },
  );

  // 4. Send New Login Notification Worker
  await boss.work(
    AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION,
    async (job: Job<SendNewLoginPayload> | Job<SendNewLoginPayload>[]) => {
      const item = Array.isArray(job) ? job[0] : job;
      if (!item) return;
      logger.info({ jobId: item.id, to: item.data.email }, `Processing new login notification for user ${item.data.userId}`);
      await emailService.sendNewLoginNotification(item.data.email, item.data.ipAddress, item.data.userAgent);
    },
  );

  // 5. Cleanup Expired Sessions Scheduled Worker
  await boss.work(AUTH_QUEUES.CLEANUP_EXPIRED_SESSIONS, async () => {
    const deletedCount = await repository.cleanupExpiredSessions();
    logger.info({ deletedCount }, 'Cleaned up expired sessions from database');
  });

  // 6. Cleanup Expired Verification Tokens Scheduled Worker
  await boss.work(AUTH_QUEUES.CLEANUP_EXPIRED_VERIFICATION_TOKENS, async () => {
    const deletedCount = await repository.cleanupExpiredVerificationTokens();
    logger.info({ deletedCount }, 'Cleaned up expired verification tokens');
  });

  // 7. Cleanup Expired Password Reset Tokens Scheduled Worker
  await boss.work(AUTH_QUEUES.CLEANUP_EXPIRED_PASSWORD_RESET_TOKENS, async () => {
    const deletedCount = await repository.cleanupExpiredPasswordResetTokens();
    logger.info({ deletedCount }, 'Cleaned up expired password reset tokens');
  });

  logger.info('Registered all Auth module PgBoss workers');
}
