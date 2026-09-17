// apps/server/tests/unit/auth/auth.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../../src/modules/auth/auth.service.js';
import { ConflictError, UnauthorizedError } from '../../../src/modules/auth/auth.errors.js';
import { googleOAuthService } from '../../../src/modules/auth/google-oauth.service.js';
import type { User, Session, OAuthAccount } from '@siteflow/database/schema';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockUser: User = {
  id: 'usr_test123',
  email: 'test@example.com',
  passwordHash: '$2a$12$e8p2H1Z1f8.g4j8V4g3u.e0g4j8V4g3u.e0g4j8V4g3u.e0g4j8V4',
  firstName: 'Test',
  lastName: 'User',
  status: 'ACTIVE',
  emailVerifiedAt: new Date(),
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOAuthAccount: OAuthAccount = {
  id: 'oa_test123',
  userId: 'usr_test123',
  provider: 'GOOGLE',
  providerAccountId: 'google_sub_123',
  email: 'test@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSession: Session = {
  id: 'ses_test123',
  userId: 'usr_test123',
  refreshTokenHash: 'hash123',
  expiresAt: new Date(Date.now() + 86400000),
  revokedAt: null,
  lastUsedAt: new Date(),
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService (Unit)', () => {
  let authService: AuthService;
  let mockRepo: any;
  let mockSessionService: any;
  let mockEmailVerificationService: any;
  let mockPasswordResetService: any;
  let mockCacheService: any;
  let mockJobs: any;

  beforeEach(() => {
    mockRepo = {
      findUserByEmail: vi.fn(),
      findUserById: vi.fn(),
      createUser: vi.fn(),
      registerUserWithVerificationToken: vi.fn(),
      updateLastLogin: vi.fn(),
      updatePasswordHash: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
      findOAuthAccount: vi.fn(),
      createOAuthUserAndAccount: vi.fn(),
      linkOAuthAccount: vi.fn(),
    };

    mockSessionService = {
      createSession: vi.fn().mockResolvedValue({ refreshToken: 'raw_refresh_token', session: mockSession }),
      rotateRefreshToken: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
      getUserSessions: vi.fn(),
    };

    mockEmailVerificationService = {
      createAndSendVerificationToken: vi.fn().mockResolvedValue('token123'),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
    };

    mockPasswordResetService = {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    };

    mockCacheService = {
      getLoginAttempts: vi.fn().mockResolvedValue(0),
      incrementLoginAttempts: vi.fn(),
      resetLoginAttempts: vi.fn(),
    };

    mockJobs = {
      enqueueEmailVerification: vi.fn(),
      enqueueNewLoginNotification: vi.fn(),
      enqueuePasswordChangedNotification: vi.fn(),
    };

    authService = new AuthService(
      mockRepo,
      mockSessionService,
      mockEmailVerificationService,
      mockPasswordResetService,
      mockCacheService,
      mockJobs,
    );
  });

  describe('register()', () => {
    it('should throw ConflictError if user email already exists', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('should register a new user successfully and return tokens', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(undefined);
      mockRepo.registerUserWithVerificationToken.mockResolvedValue({
        user: mockUser,
        verificationToken: { id: 'evt_123', userId: mockUser.id },
      });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.user.email).toBe(mockUser.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBe('raw_refresh_token');
      // Outbox pattern: outbox event is written atomically inside registerUserWithVerificationToken
      // rawToken is passed in the tokenData.rawToken field — verify the call shape
      expect(mockRepo.registerUserWithVerificationToken).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          status: 'ACTIVE',
        }),
        expect.objectContaining({
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
          rawToken: expect.any(String),
        }),
      );
      // jobs.enqueueEmailVerification is NOT called directly — the outbox handles dispatch
      expect(mockJobs.enqueueEmailVerification).not.toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    it('should throw UnauthorizedError if user not found', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(undefined);

      await expect(
        authService.login({ email: 'nonexistent@example.com', password: 'Password123!' }),
      ).rejects.toThrow(UnauthorizedError);

      expect(mockCacheService.incrementLoginAttempts).toHaveBeenCalled();
    });
  });

  describe('loginWithGoogle()', () => {
    it('should authenticate existing OAuth user via Google sub', async () => {
      vi.spyOn(googleOAuthService, 'getGoogleUserFromCode').mockResolvedValue({
        sub: 'google_sub_123',
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User',
      });

      mockRepo.findOAuthAccount.mockResolvedValue({
        ...mockOAuthAccount,
        user: mockUser,
      });

      const result = await authService.loginWithGoogle('valid_google_code');

      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBe('raw_refresh_token');
      expect(mockRepo.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should create new User + OAuthAccount if no account exists', async () => {
      vi.spyOn(googleOAuthService, 'getGoogleUserFromCode').mockResolvedValue({
        sub: 'new_google_sub',
        email: 'newgoogleuser@example.com',
        given_name: 'New',
        family_name: 'Google',
      });

      mockRepo.findOAuthAccount.mockResolvedValue(undefined);
      mockRepo.findUserByEmail.mockResolvedValue(undefined);
      mockRepo.createOAuthUserAndAccount.mockResolvedValue({
        user: { ...mockUser, id: 'usr_new_google', email: 'newgoogleuser@example.com' },
        oauthAccount: { ...mockOAuthAccount, id: 'oa_new_google' },
      });

      const result = await authService.loginWithGoogle('new_google_code');

      expect(result.user.id).toBe('usr_new_google');
      expect(result.user.email).toBe('newgoogleuser@example.com');
      expect(mockRepo.createOAuthUserAndAccount).toHaveBeenCalled();
    });
  });
});
