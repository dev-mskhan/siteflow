import { AuthRepository } from './auth.repository.js';
import { generateOneTimeToken, hashOneTimeToken } from './token.service.js';
import { ValidationError } from './auth.errors.js';

const VERIFICATION_TOKEN_TTL_HOURS = 24;

export class EmailVerificationService {
  constructor(
    private repo: AuthRepository = new AuthRepository(),
  ) {}

  /**
   * Generates a new email verification token and writes outbox event in DB transaction.
   */
  async createAndSendVerificationToken(userId: string, email: string): Promise<string> {
    const { raw, hash } = generateOneTimeToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await this.repo.createEmailVerificationTokenWithOutbox(
      {
        userId,
        tokenHash: hash,
        expiresAt,
      },
      email,
      raw,
    );



    return raw;
  }

  /**
   * Verifies an email token. Marks token used and sets emailVerifiedAt on the user atomically.
   */
  async verifyEmail(rawToken: string): Promise<void> {
    const hash = hashOneTimeToken(rawToken);
    const tokenRecord = await this.repo.findValidEmailVerificationToken(hash);

    if (!tokenRecord) {
      throw new ValidationError('Invalid or expired email verification token');
    }

    await this.repo.verifyEmailTransaction(tokenRecord.id, tokenRecord.userId);
  }

  /**
   * Resends verification email for a user if email is not yet verified.
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      // Do not reveal email existence
      return;
    }

    if (user.emailVerifiedAt) {
      throw new ValidationError('Email is already verified');
    }

    await this.createAndSendVerificationToken(user.id, user.email);
  }
}
