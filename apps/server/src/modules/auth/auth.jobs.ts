// apps/server/src/modules/auth/auth.jobs.ts

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
