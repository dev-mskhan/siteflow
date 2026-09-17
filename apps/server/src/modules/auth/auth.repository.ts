import { eq, and, gt, lt, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  users,
  sessions,
  oauthAccounts,
  emailVerificationTokens,
  passwordResetTokens,
  type User,
  type NewUser,
  type OAuthAccount,
  type Session,
  type NewSession,
  type EmailVerificationToken,
  type NewEmailVerificationToken,
  type PasswordResetToken,
  type NewPasswordResetToken,
} from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'auth-repository' });

export class AuthRepository {
  private get db() {
    return getDb();
  }

  // ─── User Operations ────────────────────────────────────────────────────────
  async findUserById(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return result[0];
  }

  async createUser(data: NewUser): Promise<User> {
    logger.debug({ email: data.email }, 'Creating new user');
    const result = await this.db.insert(users).values({
      ...data,
      email: data.email.toLowerCase(),
    }).returning();
    return result[0]!;
  }

  async updateUser(id: string, data: Partial<NewUser>): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async markEmailAsVerified(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // ─── OAuth Account Operations ───────────────────────────────────────────────
  async findOAuthAccount(
    provider: 'GOOGLE' | 'GITHUB' | 'MICROSOFT',
    providerAccountId: string,
  ): Promise<(OAuthAccount & { user: User }) | undefined> {
    const result = await this.db
      .select({
        oauthAccount: oauthAccounts,
        user: users,
      })
      .from(oauthAccounts)
      .innerJoin(users, eq(oauthAccounts.userId, users.id))
      .where(
        and(
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);

    if (!result[0]) return undefined;
    return {
      ...result[0].oauthAccount,
      user: result[0].user,
    };
  }

  async createOAuthUserAndAccount(data: {
    email: string;
    firstName: string;
    lastName?: string;
    emailVerifiedAt?: Date;
    provider: 'GOOGLE' | 'GITHUB' | 'MICROSOFT';
    providerAccountId: string;
  }): Promise<{ user: User; oauthAccount: OAuthAccount }> {
    logger.info({ email: data.email, provider: data.provider, providerAccountId: data.providerAccountId }, 'Creating new user from OAuth');

    return this.db.transaction(async (tx) => {
      const newUser = await tx
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          passwordHash: null,
          firstName: data.firstName,
          lastName: data.lastName ?? null,
          emailVerifiedAt: data.emailVerifiedAt ?? new Date(),
          status: 'ACTIVE',
        })
        .returning();

      const user = newUser[0]!;

      const newOAuth = await tx
        .insert(oauthAccounts)
        .values({
          userId: user.id,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          email: data.email.toLowerCase(),
        })
        .returning();

      return {
        user,
        oauthAccount: newOAuth[0]!,
      };
    });
  }

  async linkOAuthAccount(
    userId: string,
    provider: 'GOOGLE' | 'GITHUB' | 'MICROSOFT',
    providerAccountId: string,
    email?: string,
  ): Promise<OAuthAccount> {
    logger.info({ userId, provider, providerAccountId }, 'Linking OAuth account to existing user');
    const result = await this.db
      .insert(oauthAccounts)
      .values({
        userId,
        provider,
        providerAccountId,
        email: email ? email.toLowerCase() : null,
      })
      .returning();
    return result[0]!;
  }

  // ─── Session Operations ─────────────────────────────────────────────────────
  async createSession(data: NewSession): Promise<Session> {
    const result = await this.db.insert(sessions).values(data).returning();
    return result[0]!;
  }

  async findSessionById(id: string): Promise<Session | undefined> {
    const result = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0];
  }

  async findValidSessionByHash(refreshTokenHash: string): Promise<Session | undefined> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshTokenHash, refreshTokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .limit(1);
    return result[0];
  }

  async findActiveUserSessions(userId: string): Promise<Session[]> {
    const now = new Date();
    return this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      );
  }

  async updateSessionToken(
    sessionId: string,
    newHash: string,
    newExpiresAt: Date,
  ): Promise<Session | undefined> {
    const result = await this.db
      .update(sessions)
      .set({
        refreshTokenHash: newHash,
        expiresAt: newExpiresAt,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();
    return result[0];
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const conditions = exceptSessionId
      ? and(eq(sessions.userId, userId), isNull(sessions.revokedAt), sql`${sessions.id} != ${exceptSessionId}`)
      : and(eq(sessions.userId, userId), isNull(sessions.revokedAt));

    const result = await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(conditions)
      .returning({ id: sessions.id });

    return result.length;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });
    return result.length;
  }

  // ─── Email Verification Token Operations ──────────────────────────────────
  async createEmailVerificationToken(data: NewEmailVerificationToken): Promise<EmailVerificationToken> {
    // Invalidate existing unused tokens for this user first
    await this.db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.userId, data.userId),
          isNull(emailVerificationTokens.usedAt),
        ),
      );

    const result = await this.db.insert(emailVerificationTokens).values(data).returning();
    return result[0]!;
  }

  async findValidEmailVerificationToken(tokenHash: string): Promise<EmailVerificationToken | undefined> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, now),
        ),
      )
      .limit(1);
    return result[0];
  }

  async markEmailVerificationTokenUsed(id: string): Promise<void> {
    await this.db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, id));
  }

  async cleanupExpiredVerificationTokens(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(emailVerificationTokens)
      .where(lt(emailVerificationTokens.expiresAt, now))
      .returning({ id: emailVerificationTokens.id });
    return result.length;
  }

  // ─── Password Reset Token Operations ─────────────────────────────────────
  async createPasswordResetToken(data: NewPasswordResetToken): Promise<PasswordResetToken> {
    // Invalidate existing unused tokens for this user first
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, data.userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    const result = await this.db.insert(passwordResetTokens).values(data).returning();
    return result[0]!;
  }

  async findValidPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .limit(1);
    return result[0];
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now))
      .returning({ id: passwordResetTokens.id });
    return result.length;
  }
}
