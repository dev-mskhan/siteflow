// apps/server/src/modules/auth/auth.service.ts
import { eq } from 'drizzle-orm';
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { users } from '@siteflow/database/schema';
import { AuthRepository } from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { createAccessToken, generateOneTimeToken } from './token.service.js';
import { SessionService } from './session.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { googleOAuthService } from './google-oauth.service.js';
import { AuthCacheService } from './auth.cache.service.js';
import { AUTH_QUEUES } from './auth.jobs.js';
import { writeOutboxEvent } from '../../lib/outbox/outbox.service.js';
import { getDb } from '../../lib/db/index.js';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  TooManyRequestsError,
} from './auth.errors.js';
import type { User } from '@siteflow/database/schema';
import type {
  RegisterInput,
  LoginInput,
  VerifyEmailInput,
  ResendVerificationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UserDTO,
  SessionDTO,
} from '@siteflow/shared';

const logger = createLogger({ name: 'auth-service' });
const tracer = trace.getTracer('auth-service');

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status as UserDTO['status'],
    emailVerified: Boolean(user.emailVerifiedAt),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export class AuthService {
  constructor(
    private repo = new AuthRepository(),
    private sessionService = new SessionService(repo),
    private emailVerificationService = new EmailVerificationService(repo),
    private passwordResetService = new PasswordResetService(repo),
    private cacheService = new AuthCacheService(),
  ) {}

  // ─── Register ───────────────────────────────────────────────────────────────
  async register(input: RegisterInput): Promise<{ user: UserDTO; accessToken: string; refreshToken: string }> {
    return withSpan(tracer, 'auth.register', async (span) => {
      span.setAttribute('user.email', input.email);
      logger.info({ email: input.email }, 'Processing user registration');

      const existingUser = await this.repo.findUserByEmail(input.email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      const passwordHash = await hashPassword(input.password);
      const { raw: rawVerificationToken, hash: tokenHash } = generateOneTimeToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const { user: newUser } = await this.repo.registerUserWithVerificationToken(
        {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          status: 'ACTIVE',
        },
        {
          tokenHash,
          expiresAt,
          rawToken: rawVerificationToken,
        },
      );

      // Invalidate any potential email lookup cache
      await this.cacheService.invalidateUserByEmail(input.email);

      // Create session
      const { refreshToken, session } = await this.sessionService.createSession(newUser.id);
      const accessToken = createAccessToken({
        sub: newUser.id,
        email: newUser.email,
        status: newUser.status as any,
        sessionId: session.id,
      });

      logger.info({ userId: newUser.id }, 'User registered successfully');
      return {
        user: toUserDTO(newUser),
        accessToken,
        refreshToken,
      };
    });
  }

  // ─── Login ──────────────────────────────────────────────────────────────────
  async login(
    input: LoginInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: UserDTO; accessToken: string; refreshToken: string }> {
    return withSpan(tracer, 'auth.login', async (span) => {
      span.setAttribute('user.email', input.email);
      logger.info({ email: input.email }, 'Processing user login attempt');

      // Check login attempts rate limiting with email hash to prevent PII exposure in Redis keys
      const attemptsKey = `${AuthCacheService.hashEmail(input.email)}:${ipAddress ?? 'unknown'}`;
      const attempts = await this.cacheService.getLoginAttempts(attemptsKey);
      if (attempts >= 5) {
        throw new TooManyRequestsError('Too many failed login attempts. Please try again after 15 minutes.');
      }

      // Cache-aside pattern for user-by-email lookup (60s TTL)
      let user = (await this.cacheService.getUserByEmail(input.email)) ?? undefined;
      if (!user) {
        user = await this.repo.findUserByEmail(input.email);
        if (user) {
          await this.cacheService.setUserByEmail(input.email, user, 60);
        }
      }

      if (!user || !user.passwordHash) {
        await this.cacheService.incrementLoginAttempts(attemptsKey);
        throw new UnauthorizedError('Invalid email or password');
      }

      if (user.status === 'SUSPENDED') {
        throw new ForbiddenError('Account is suspended');
      }

      const isValidPassword = await verifyPassword(input.password, user.passwordHash);
      if (!isValidPassword) {
        await this.cacheService.incrementLoginAttempts(attemptsKey);
        throw new UnauthorizedError('Invalid email or password');
      }

      // Reset login attempt count on success
      await this.cacheService.resetLoginAttempts(attemptsKey);

      // Invalidate active user sessions list cache so GET /sessions reflects the new login
      await this.cacheService.invalidateUserSessions(user.id);

      // Create session & JWT token
      const { refreshToken, session } = await this.sessionService.createSession(user.id, ipAddress, userAgent);
      const accessToken = createAccessToken({
        sub: user.id,
        email: user.email,
        status: user.status as any,
        sessionId: session.id,
      });

      // Atomically update last login timestamp and write new-login notification to outbox
      await getDb().transaction(async (tx) => {
        await tx
          .update(users)
          .set({ lastLoginAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await writeOutboxEvent(
          tx,
          AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION,
          { userId: user.id, email: user.email, ipAddress, userAgent },
        );
      });

      logger.info({ userId: user.id }, 'User logged in successfully');
      return {
        user: toUserDTO(user),
        accessToken,
        refreshToken,
      };
    });
  }

  // ─── Google OAuth 2.0 ───────────────────────────────────────────────────────
  getGoogleAuthUrl(state?: string, codeChallenge?: string): { url: string } {
    return { url: googleOAuthService.getAuthorizationUrl(state, codeChallenge) };
  }

  async loginWithGoogle(
    code: string,
    ipAddress?: string,
    userAgent?: string,
    codeVerifier?: string,
  ): Promise<{ user: UserDTO; accessToken: string; refreshToken: string }> {
    return withSpan(tracer, 'auth.loginWithGoogle', async (span) => {
      const googleUser = await googleOAuthService.getGoogleUserFromCode(code, codeVerifier);
      span.setAttribute('google.sub', googleUser.sub);
      span.setAttribute('google.email', googleUser.email);

      logger.info({ sub: googleUser.sub, email: googleUser.email }, 'Processing Google OAuth login/signup');

      let oauthMatch = await this.repo.findOAuthAccount('GOOGLE', googleUser.sub);
      let user: User;

      if (oauthMatch) {
        user = oauthMatch.user;
      } else {
        const existingUserByEmail = await this.repo.findUserByEmail(googleUser.email);

        if (existingUserByEmail) {
          user = existingUserByEmail;
          await this.repo.linkOAuthAccount(user.id, 'GOOGLE', googleUser.sub, googleUser.email);
        } else {
          const created = await this.repo.createOAuthUserAndAccount({
            email: googleUser.email,
            firstName: googleUser.given_name ?? 'Google User',
            lastName: googleUser.family_name ?? undefined,
            emailVerifiedAt: googleUser.email_verified ? new Date() : undefined,
            provider: 'GOOGLE',
            providerAccountId: googleUser.sub,
          });
          user = created.user;
        }
      }

      if (user.status === 'SUSPENDED') {
        throw new ForbiddenError('Account is suspended');
      }

      // Invalidate caches on login/signup write
      await this.cacheService.invalidateUserProfile(user.id);
      await this.cacheService.invalidateUserSessions(user.id);
      await this.cacheService.invalidateUserByEmail(user.email);

      // Create Session & JWT token
      const { refreshToken, session } = await this.sessionService.createSession(user.id, ipAddress, userAgent);
      const accessToken = createAccessToken({
        sub: user.id,
        email: user.email,
        status: user.status as any,
        sessionId: session.id,
      });

      // Atomically update last login timestamp and write new-login notification to outbox
      await getDb().transaction(async (tx) => {
        await tx
          .update(users)
          .set({ lastLoginAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await writeOutboxEvent(
          tx,
          AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION,
          { userId: user.id, email: user.email, ipAddress, userAgent },
        );
      });

      logger.info({ userId: user.id, provider: 'GOOGLE' }, 'User authenticated successfully via Google OAuth');
      return {
        user: toUserDTO(user),
        accessToken,
        refreshToken,
      };
    });
  }

  // ─── Refresh Token ──────────────────────────────────────────────────────────
  async refreshToken(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return withSpan(tracer, 'auth.refreshToken', async () => {
      const { refreshToken: newRefreshToken, session, user } = await this.sessionService.rotateRefreshToken(
        rawRefreshToken,
        ipAddress,
        userAgent,
      );

      // Invalidate old session cache and user sessions list on token rotation
      await this.cacheService.invalidateSession(session.id);
      await this.cacheService.invalidateUserSessions(user.id);

      const accessToken = createAccessToken({
        sub: user.id,
        email: user.email,
        status: user.status as any,
        sessionId: session.id,
      });

      return { accessToken, refreshToken: newRefreshToken };
    });
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────
  async logout(sessionId?: string, userId?: string): Promise<void> {
    return withSpan(tracer, 'auth.logout', async () => {
      if (sessionId) {
        await this.repo.revokeSession(sessionId);
        await this.cacheService.invalidateSession(sessionId);
      }
      if (userId) {
        await this.cacheService.invalidateUserSessions(userId);
      }
    });
  }

  // ─── Email Verification ─────────────────────────────────────────────────────
  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    return withSpan(tracer, 'auth.verifyEmail', async () => {
      const userId = await this.emailVerificationService.verifyEmail(input.token);
      if (userId) {
        await this.cacheService.invalidateAllUserCaches(userId);
      }
    });
  }

  async resendVerification(input: ResendVerificationInput): Promise<void> {
    return withSpan(tracer, 'auth.resendVerification', async () => {
      // Rate limiting: INCR/EXPIRE pattern with 15 minute window for resend-verification
      const count = await this.cacheService.incrementRateLimit('resend', input.email, 900);
      if (count > 3) {
        throw new TooManyRequestsError('Too many verification requests. Please try again in 15 minutes.');
      }
      await this.emailVerificationService.resendVerification(input.email);
    });
  }

  // ─── Password Reset ─────────────────────────────────────────────────────────
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    return withSpan(tracer, 'auth.forgotPassword', async () => {
      // Rate limiting: INCR/EXPIRE pattern with 15 minute window for forgot-password
      const count = await this.cacheService.incrementRateLimit('forgot', input.email, 900);
      if (count > 3) {
        throw new TooManyRequestsError('Too many password reset requests. Please try again in 15 minutes.');
      }
      await this.passwordResetService.requestPasswordReset(input.email);
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    return withSpan(tracer, 'auth.resetPassword', async () => {
      const userId = await this.passwordResetService.resetPassword(input.token, input.newPassword);
      if (userId) {
        await this.cacheService.invalidateAllUserCaches(userId);
      }
    });
  }

  // ─── Change Password ────────────────────────────────────────────────────────
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    return withSpan(tracer, 'auth.changePassword', async () => {
      const user = await this.repo.findUserById(userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      if (!user.passwordHash) {
        throw new ValidationError('Account was created via OAuth and has no password set');
      }

      const isValidPassword = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new ValidationError('Current password does not match');
      }

      const newPasswordHash = await hashPassword(input.newPassword);
      await this.repo.changePasswordTransaction(userId, user.email, newPasswordHash);

      // Strong consistency requirement: invalidate user profile, user sessions, and email lookup immediately
      await this.cacheService.invalidateAllUserCaches(userId, user.email);
    });
  }

  // ─── Profile & Sessions ─────────────────────────────────────────────────────
  async getUserProfile(userId: string): Promise<UserDTO> {
    return withSpan(tracer, 'auth.getUserProfile', async () => {
      // Cache-aside pattern for GET /me (auth:user:{userId})
      const cachedProfile = await this.cacheService.getUserProfile(userId);
      if (cachedProfile) {
        return cachedProfile;
      }

      const user = await this.repo.findUserById(userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }
      const dto = toUserDTO(user);
      // Cache profile with 5 minute TTL (jittered 270-330s for stampede protection)
      await this.cacheService.setUserProfile(userId, dto, 300);
      return dto;
    });
  }

  async getUserSessions(userId: string, currentSessionId?: string): Promise<{ data: SessionDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'auth.getUserSessions', async () => {
      // Cache-aside pattern for active sessions list (auth:sessions:{userId})
      // Cache still stores raw SessionDTO[] — unwrap after cache hit
      const cachedSessions = await this.cacheService.getUserSessions(userId);
      if (cachedSessions) {
        const sessions = cachedSessions.map((s) => ({
          ...s,
          isCurrent: s.id === currentSessionId,
        }));
        return { data: sessions, nextCursor: null };
      }

      const sessions = await this.sessionService.getUserSessions(userId, currentSessionId);
      // Cache the raw array (without the wrapper) for 45 seconds
      await this.cacheService.setUserSessions(userId, sessions, 45);
      return { data: sessions, nextCursor: null };
    });
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    return withSpan(tracer, 'auth.deleteSession', async () => {
      await this.sessionService.revokeSession(sessionId, userId);
      await this.cacheService.invalidateSession(sessionId);
      await this.cacheService.invalidateUserSessions(userId);
    });
  }

  async logoutAll(userId: string): Promise<number> {
    return withSpan(tracer, 'auth.logoutAll', async () => {
      const count = await this.sessionService.revokeAllUserSessions(userId);
      await this.cacheService.invalidateAllUserCaches(userId);
      return count;
    });
  }
}
