// apps/server/src/modules/auth/auth.jobs.ts
import { sendJob } from '../../lib/queue/queue.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'auth-jobs' });

export const AUTH_QUEUES = {
  SEND_EMAIL_VERIFICATION: 'auth:send-email-verification',
  SEND_PASSWORD_RESET: 'auth:send-password-reset',
  SEND_PASSWORD_CHANGED_NOTIFICATION: 'auth:send-password-changed-notification',
  SEND_NEW_LOGIN_NOTIFICATION: 'auth:send-new-login-notification',
  CLEANUP_EXPIRED_SESSIONS: 'auth:cleanup-expired-sessions',
  CLEANUP_EXPIRED_VERIFICATION_TOKENS: 'auth:cleanup-expired-verification-tokens',
  CLEANUP_EXPIRED_PASSWORD_RESET_TOKENS: 'auth:cleanup-expired-password-reset-tokens',
} as const;

export interface SendEmailVerificationPayload {
  userId: string;
  email: string;
  token: string;
}

export interface SendPasswordResetPayload {
  userId: string;
  email: string;
  token: string;
}

export interface SendPasswordChangedPayload {
  userId: string;
  email: string;
}

export interface SendNewLoginPayload {
  userId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthJobs {
  async enqueueEmailVerification(payload: SendEmailVerificationPayload): Promise<string | null> {
    logger.info({ userId: payload.userId, email: payload.email }, 'Enqueuing email verification job');
    return sendJob(AUTH_QUEUES.SEND_EMAIL_VERIFICATION as any, payload as any);
  }

  async enqueuePasswordReset(payload: SendPasswordResetPayload): Promise<string | null> {
    logger.info({ userId: payload.userId, email: payload.email }, 'Enqueuing password reset job');
    return sendJob(AUTH_QUEUES.SEND_PASSWORD_RESET as any, payload as any);
  }

  async enqueuePasswordChangedNotification(payload: SendPasswordChangedPayload): Promise<string | null> {
    logger.info({ userId: payload.userId }, 'Enqueuing password changed notification job');
    return sendJob(AUTH_QUEUES.SEND_PASSWORD_CHANGED_NOTIFICATION as any, payload as any);
  }

  async enqueueNewLoginNotification(payload: SendNewLoginPayload): Promise<string | null> {
    logger.info({ userId: payload.userId }, 'Enqueuing new login notification job');
    return sendJob(AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION as any, payload as any);
  }
}
