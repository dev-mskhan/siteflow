// apps/server/src/modules/auth/password-reset.service.ts
import { AuthRepository } from './auth.repository.js';
import { generateOneTimeToken, hashOneTimeToken } from './token.service.js';
import { hashPassword } from './password.service.js';
import { ValidationError } from './auth.errors.js';
import { outboxService } from '../../lib/outbox/outbox.service.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'password-reset-service' });
const RESET_TOKEN_TTL_MINUTES = 60;

export class PasswordResetService {
  constructor(
    private repo: AuthRepository = new AuthRepository(),
  ) {}

  /**
   * Initiates password reset flow by creating a token and writing outbox event in DB transaction.
   * Fails silently if user does not exist for security (anti-enumeration).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      return; // Silent return
    }

    const { raw, hash } = generateOneTimeToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await this.repo.createPasswordResetTokenWithOutbox(
      {
        userId: user.id,
        tokenHash: hash,
        expiresAt,
      },
      user.email,
      raw,
    );

    try {
      await outboxService.publishPendingEvents();
    } catch (err) {
      logger.error({ err, userId: user.id, email }, 'Failed immediate outbox sweep for password reset');
    }
  }

  /**
   * Resets user password using valid token.
   * Uses atomic DB transaction to mark token used, update password, revoke active user sessions, and write outbox event.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hash = hashOneTimeToken(rawToken);
    const tokenRecord = await this.repo.findValidPasswordResetToken(hash);

    if (!tokenRecord) {
      throw new ValidationError('Invalid or expired password reset token');
    }

    const user = await this.repo.findUserById(tokenRecord.userId);
    if (!user) {
      throw new ValidationError('User associated with token not found');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Atomically update password hash, mark token used, revoke sessions, and insert outbox event
    await this.repo.resetPasswordTransaction(tokenRecord.id, user.id, user.email, newPasswordHash);

    try {
      await outboxService.publishPendingEvents();
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed immediate outbox sweep after password reset');
    }
  }
}
