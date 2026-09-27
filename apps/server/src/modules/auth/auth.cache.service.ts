// apps/server/src/modules/auth/auth.cache.service.ts
import crypto from 'node:crypto';
import { ensureRedisConnected } from '../../lib/redis/redis.js';
import { createLogger } from '@siteflow/observability/server';
import type { User } from '@siteflow/database/schema';
import type { UserDTO, SessionDTO } from '@siteflow/shared';

const logger = createLogger({ name: 'auth-cache-service' });

export class AuthCacheService {
  /**
   * Hashes normalized email (lowercased + trimmed) using SHA-256
   * to prevent raw email addresses in Redis keys (PII protection).
   */
  static hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  /**
   * Returns a TTL with random jitter (+/- jitterRangeSeconds)
   * to protect hot keys against cache stampedes (§3 & §6).
   */
  static getJitteredTTL(baseSeconds: number, jitterRangeSeconds = 30): number {
    const jitter = Math.floor(Math.random() * (jitterRangeSeconds * 2 + 1)) - jitterRangeSeconds;
    return Math.max(10, baseSeconds + jitter);
  }

  // ─── Rate Limiting / Attempt Throttling ──────────────────────────────────

  async incrementLoginAttempts(ipOrEmail: string, ttlSeconds = 900): Promise<number> {
    try {
      const client = await ensureRedisConnected();
      const identifier = ipOrEmail.includes('@') ? AuthCacheService.hashEmail(ipOrEmail) : ipOrEmail;
      const key = `auth:login_attempts:${identifier}`;
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }
      return count;
    } catch (err) {
      logger.error({ err }, 'Failed to increment login attempts in Redis');
      return 0; // Fail open
    }
  }

  async getLoginAttempts(ipOrEmail: string): Promise<number> {
    try {
      const client = await ensureRedisConnected();
      const identifier = ipOrEmail.includes('@') ? AuthCacheService.hashEmail(ipOrEmail) : ipOrEmail;
      const key = `auth:login_attempts:${identifier}`;
      const val = await client.get(key);
      return val ? parseInt(val, 10) : 0;
    } catch (err) {
      logger.error({ err }, 'Failed to get login attempts from Redis');
      return 0;
    }
  }

  async resetLoginAttempts(ipOrEmail: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const identifier = ipOrEmail.includes('@') ? AuthCacheService.hashEmail(ipOrEmail) : ipOrEmail;
      const key = `auth:login_attempts:${identifier}`;
      await client.del(key);
    } catch (err) {
      logger.error({ err }, 'Failed to reset login attempts in Redis');
    }
  }

  async incrementRateLimit(prefix: string, email: string, ttlSeconds = 900): Promise<number> {
    try {
      const client = await ensureRedisConnected();
      const emailHash = AuthCacheService.hashEmail(email);
      const key = `auth:ratelimit:${prefix}:${emailHash}`;
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }
      return count;
    } catch (err) {
      logger.error({ err, prefix }, 'Failed to increment rate limit in Redis');
      return 0; // Fail open
    }
  }

  // ─── Cache-Aside: User by Email (POST /login) ────────────────────────────

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const client = await ensureRedisConnected();
      const emailHash = AuthCacheService.hashEmail(email);
      const key = `auth:user:email:${emailHash}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached, (k, v) => {
          if (k === 'createdAt' || k === 'updatedAt' || k === 'emailVerifiedAt' || k === 'lastLoginAt') {
            return v ? new Date(v) : null;
          }
          return v;
        }) as User;
      }
    } catch (err) {
      logger.warn({ err }, 'Redis getUserByEmail read failed — falling back to DB');
    }
    return null;
  }

  async setUserByEmail(email: string, user: User, ttlSeconds = 60): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const emailHash = AuthCacheService.hashEmail(email);
      const key = `auth:user:email:${emailHash}`;
      await client.set(key, JSON.stringify(user), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err }, 'Redis setUserByEmail write failed');
    }
  }

  async invalidateUserByEmail(email: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const emailHash = AuthCacheService.hashEmail(email);
      const key = `auth:user:email:${emailHash}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err }, 'Redis invalidateUserByEmail failed');
    }
  }

  // ─── Cache-Aside: User Profile (GET /me) ─────────────────────────────────

  async getUserProfile(userId: string): Promise<UserDTO | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:user:${userId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as UserDTO;
      }
    } catch (err) {
      logger.warn({ err }, 'Redis getUserProfile read failed — falling back to DB');
    }
    return null;
  }

  async setUserProfile(userId: string, userDto: UserDTO, baseTtlSeconds = 300): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:user:${userId}`;
      const ttl = AuthCacheService.getJitteredTTL(baseTtlSeconds, 30);
      await client.set(key, JSON.stringify(userDto), 'EX', ttl);
    } catch (err) {
      logger.warn({ err }, 'Redis setUserProfile write failed');
    }
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:user:${userId}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err }, 'Redis invalidateUserProfile failed');
    }
  }

  // ─── Cache-Aside: Session Validity (POST /refresh) ───────────────────────

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:session:${sessionId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn({ err }, 'Redis getSession read failed');
    }
    return null;
  }

  async setSession(sessionId: string, sessionData: any, ttlSeconds = 30): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:session:${sessionId}`;
      await client.set(key, JSON.stringify(sessionData), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err }, 'Redis setSession write failed');
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:session:${sessionId}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err }, 'Redis invalidateSession failed');
    }
  }

  // ─── Cache-Aside: User Active Sessions List (GET /sessions) ──────────────

  async getUserSessions(userId: string): Promise<SessionDTO[] | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:sessions:${userId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as SessionDTO[];
      }
    } catch (err) {
      logger.warn({ err }, 'Redis getUserSessions read failed');
    }
    return null;
  }

  async setUserSessions(userId: string, sessions: SessionDTO[], ttlSeconds = 45): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:sessions:${userId}`;
      await client.set(key, JSON.stringify(sessions), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err }, 'Redis setUserSessions write failed');
    }
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:sessions:${userId}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err }, 'Redis invalidateUserSessions failed');
    }
  }

  // ─── Bulk Invalidation ───────────────────────────────────────────────────

  async invalidateAllUserCaches(userId: string, email?: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const keysToDelete: string[] = [`auth:user:${userId}`, `auth:sessions:${userId}`];
      if (email) {
        keysToDelete.push(`auth:user:email:${AuthCacheService.hashEmail(email)}`);
      }
      await client.del(...keysToDelete);
    } catch (err) {
      logger.warn({ err }, 'Redis invalidateAllUserCaches failed');
    }
  }
}
