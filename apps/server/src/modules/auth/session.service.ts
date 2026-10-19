// apps/server/src/modules/auth/session.service.ts
import { AuthRepository } from './auth.repository.js';
import { generateRefreshToken, hashRefreshToken } from './token.service.js';
import { serverEnv } from '../../config/env.js';
import { UnauthorizedError, NotFoundError } from './auth.errors.js';
import { authCacheService, type AuthCacheService } from './auth.cache.service.js';
import { createLogger } from '@siteflow/observability/server';
import type { Session, User } from '@siteflow/database/schema';
import type { SessionDTO } from '@siteflow/shared';

const logger = createLogger({ name: 'session-service' });

export class SessionService {
  constructor(
    private repo: AuthRepository = new AuthRepository(),
    private cacheService: AuthCacheService = authCacheService,
  ) {}

  /**
   * Creates a new session in PostgreSQL for a user.
   * Returns the raw refresh token (for cookie) and the created session entity.
   */
  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ refreshToken: string; session: Session }> {
    const { raw, hash } = generateRefreshToken();
    const expiresAt = new Date(
      Date.now() + serverEnv.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    const session = await this.repo.createSession({
      userId,
      refreshTokenHash: hash,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    return { refreshToken: raw, session };
  }

  /**
   * Rotates an existing refresh token (Refresh Token Rotation).
   * Validates the provided refresh token hash, revokes old session or updates hash & expiry,
   * returns new raw refresh token and updated session.
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ refreshToken: string; session: Session; user: User }> {
    const hash = hashRefreshToken(rawRefreshToken);
    const session = await this.repo.findValidSessionByHash(hash);

    if (!session) {
      // RFC 6749 / OAuth 2.0 Security BCP: Refresh Token Reuse Detection
      const compromisedUserId = await this.cacheService.getUsedRefreshTokenUserId(hash);
      if (compromisedUserId) {
        logger.error(
          { userId: compromisedUserId },
          'SECURITY ALERT: Reused refresh token detected! Revoking all sessions for compromised account.',
        );
        await this.repo.revokeAllUserSessions(compromisedUserId);
        await this.cacheService.invalidateAllUserCaches(compromisedUserId);
        await this.cacheService.markUserSessionsRevoked(compromisedUserId);
        throw new UnauthorizedError('Token reuse detected. All sessions revoked for security.');
      }
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await this.repo.findUserById(session.userId);
    if (!user || user.status === 'SUSPENDED') {
      await this.repo.revokeSession(session.id);
      await this.cacheService.markSessionRevoked(session.id);
      throw new UnauthorizedError('User account is invalid or suspended');
    }

    // Generate new refresh token
    const { raw: newRaw, hash: newHash } = generateRefreshToken();
    const newExpiresAt = new Date(
      Date.now() + serverEnv.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    const updatedSession = await this.repo.updateSessionToken(session.id, newHash, newExpiresAt);
    if (!updatedSession) {
      throw new UnauthorizedError('Failed to rotate session');
    }

    // Record previously valid token hash so future re-use triggers automatic account breach mitigation
    await this.cacheService.recordUsedRefreshToken(hash, session.userId);

    // Update IP/UserAgent if present
    if (ipAddress || userAgent) {
      await this.repo.updateSessionToken(session.id, newHash, newExpiresAt);
    }

    return { refreshToken: newRaw, session: updatedSession, user };
  }

  /**
   * Revokes a single session by ID.
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.repo.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundError('Session not found');
    }
    await this.repo.revokeSession(sessionId);
    await this.cacheService.markSessionRevoked(sessionId);
  }

  /**
   * Revokes all active sessions for a user (Optionally preserving current session).
   */
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const count = await this.repo.revokeAllUserSessions(userId, exceptSessionId);
    await this.cacheService.markUserSessionsRevoked(userId);
    return count;
  }

  /**
   * Lists all active sessions for a user formatted as SessionDTO.
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<SessionDTO[]> {
    const activeSessions = await this.repo.findActiveUserSessions(userId);
    return activeSessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
  }
}
