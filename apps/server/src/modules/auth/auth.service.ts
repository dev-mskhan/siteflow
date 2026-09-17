// apps/server/src/modules/auth/auth.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { AuthRepository } from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { createAccessToken } from './token.service.js';
import { SessionService } from './session.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { googleOAuthService } from './google-oauth.service.js';
import { AuthCacheService } from './auth.cache.service.js';
import { AuthJobs } from './auth.jobs.js';
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
    private jobs = new AuthJobs(),
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
      const newUser = await this.repo.createUser({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: 'ACTIVE',
      });

      // Send verification token via background job
      await this.emailVerificationService.createAndSendVerificationToken(newUser.id, newUser.email);

      // Create session
      const { refreshToken } = await this.sessionService.createSession(newUser.id);
      const accessToken = createAccessToken({
        sub: newUser.id,
        email: newUser.email,
        status: newUser.status as any,
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

      // Check login attempts rate limiting / throttling
      const attemptsKey = `${input.email}:${ipAddress ?? 'unknown'}`;
      const attempts = await this.cacheService.getLoginAttempts(attemptsKey);
      if (attempts >= 5) {
        throw new TooManyRequestsError('Too many failed login attempts. Please try again after 15 minutes.');
      }

      const user = await this.repo.findUserByEmail(input.email);
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

      // Update last login timestamp
      await this.repo.updateLastLogin(user.id);

      // Create session & JWT token
      const { refreshToken } = await this.sessionService.createSession(user.id, ipAddress, userAgent);
      const accessToken = createAccessToken({
        sub: user.id,
        email: user.email,
        status: user.status as any,
      });

      // Send new login notification job
      await this.jobs.enqueueNewLoginNotification({
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
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
  getGoogleAuthUrl(): { url: string } {
    return { url: googleOAuthService.getAuthorizationUrl() };
  }

  async loginWithGoogle(
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: UserDTO; accessToken: string; refreshToken: string }> {
    return withSpan(tracer, 'auth.loginWithGoogle', async (span) => {
      const googleUser = await googleOAuthService.getGoogleUserFromCode(code);
      span.setAttribute('google.sub', googleUser.sub);
      span.setAttribute('google.email', googleUser.email);

      logger.info({ sub: googleUser.sub, email: googleUser.email }, 'Processing Google OAuth login/signup');

      // 1. Search for existing OAuthAccount (provider=GOOGLE, providerAccountId=sub)
      let oauthMatch = await this.repo.findOAuthAccount('GOOGLE', googleUser.sub);
      let user: User;

      if (oauthMatch) {
        user = oauthMatch.user;
      } else {
        // 2. Check if a local user exists with the same email address
        const existingUserByEmail = await this.repo.findUserByEmail(googleUser.email);

        if (existingUserByEmail) {
          user = existingUserByEmail;
          // Link new Google OAuth account to existing user
          await this.repo.linkOAuthAccount(user.id, 'GOOGLE', googleUser.sub, googleUser.email);
        } else {
          // 3. Create new User + OAuthAccount
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

      // Update last login timestamp
      await this.repo.updateLastLogin(user.id);

      // Create Session & JWT token
      const { refreshToken } = await this.sessionService.createSession(user.id, ipAddress, userAgent);
      const accessToken = createAccessToken({
        sub: user.id,
        email: user.email,
        status: user.status as any,
      });

      // Send new login notification job
      await this.jobs.enqueueNewLoginNotification({
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
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
      const { refreshToken: newRefreshToken, user } = await this.sessionService.rotateRefreshToken(
        rawRefreshToken,
        ipAddress,
        userAgent,
      );

      const accessToken = createAccessToken({
        sub: user.id,
        email: user.email,
        status: user.status as any,
      });

      return { accessToken, refreshToken: newRefreshToken };
    });
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────
  async logout(sessionId?: string): Promise<void> {
    return withSpan(tracer, 'auth.logout', async () => {
      if (sessionId) {
        await this.repo.revokeSession(sessionId);
      }
    });
  }

  // ─── Email Verification ─────────────────────────────────────────────────────
  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    return withSpan(tracer, 'auth.verifyEmail', async () => {
      await this.emailVerificationService.verifyEmail(input.token);
    });
  }

  async resendVerification(input: ResendVerificationInput): Promise<void> {
    return withSpan(tracer, 'auth.resendVerification', async () => {
      await this.emailVerificationService.resendVerification(input.email);
    });
  }

  // ─── Password Reset ─────────────────────────────────────────────────────────
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    return withSpan(tracer, 'auth.forgotPassword', async () => {
      await this.passwordResetService.requestPasswordReset(input.email);
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    return withSpan(tracer, 'auth.resetPassword', async () => {
      await this.passwordResetService.resetPassword(input.token, input.newPassword);
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
      await this.repo.updatePasswordHash(userId, newPasswordHash);

      // Revoke all other sessions for security
      await this.repo.revokeAllUserSessions(userId);

      await this.jobs.enqueuePasswordChangedNotification({ userId: user.id, email: user.email });
    });
  }

  // ─── Profile & Sessions ─────────────────────────────────────────────────────
  async getUserProfile(userId: string): Promise<UserDTO> {
    return withSpan(tracer, 'auth.getUserProfile', async () => {
      const user = await this.repo.findUserById(userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }
      return toUserDTO(user);
    });
  }

  async getUserSessions(userId: string, currentSessionId?: string): Promise<SessionDTO[]> {
    return withSpan(tracer, 'auth.getUserSessions', async () => {
      return this.sessionService.getUserSessions(userId, currentSessionId);
    });
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    return withSpan(tracer, 'auth.deleteSession', async () => {
      await this.sessionService.revokeSession(sessionId, userId);
    });
  }

  async logoutAll(userId: string): Promise<number> {
    return withSpan(tracer, 'auth.logoutAll', async () => {
      return this.sessionService.revokeAllUserSessions(userId);
    });
  }
}
