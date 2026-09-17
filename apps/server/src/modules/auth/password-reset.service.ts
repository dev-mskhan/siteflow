// apps/server/src/modules/auth/password-reset.service.ts
import { AuthRepository } from './auth.repository.js';
import { generateOneTimeToken, hashOneTimeToken } from './token.service.js';
import { hashPassword } from './password.service.js';
import { AuthJobs } from './auth.jobs.js';
import { ValidationError } from './auth.errors.js';

const RESET_TOKEN_TTL_MINUTES = 60;

export class PasswordResetService {
  constructor(
    private repo: AuthRepository = new AuthRepository(),
    private jobs: AuthJobs = new AuthJobs(),
  ) {}

  /**
   * Initiates password reset flow by creating a token and sending email.
   * Fails silently if user does not exist for security (anti-enumeration).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      return; // Silent return
    }

    const { raw, hash } = generateOneTimeToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await this.repo.createPasswordResetToken({
      userId: user.id,
      tokenHash: hash,
      expiresAt,
    });

    await this.jobs.enqueuePasswordReset({ userId: user.id, email: user.email, token: raw });
  }

  /**
   * Resets user password using valid token.
   * Also revokes all existing active user sessions and sends notification.
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

    // Update password
    await this.repo.updatePasswordHash(user.id, newPasswordHash);

    // Mark token used
    await this.repo.markPasswordResetTokenUsed(tokenRecord.id);

    // Revoke all active sessions for security
    await this.repo.revokeAllUserSessions(user.id);

    // Enqueue password changed notification
    await this.jobs.enqueuePasswordChangedNotification({ userId: user.id, email: user.email });
  }
}
