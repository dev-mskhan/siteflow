// apps/server/src/modules/auth/auth.cache.service.ts
import { Redis } from 'ioredis';
import { serverEnv } from '../../config/env.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'auth-cache-service' });

export class AuthCacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(serverEnv.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection warning in AuthCacheService');
    });
  }

  private async getClient(): Promise<Redis> {
    if (this.redis.status === 'wait') {
      await this.redis.connect().catch((err) => {
        logger.warn({ err: err.message }, 'Redis failed to connect lazily');
      });
    }
    return this.redis;
  }

  // ─── Rate Limiting / Attempt Throttling ──────────────────────────────────
  async incrementLoginAttempts(ipOrEmail: string, ttlSeconds = 900): Promise<number> {
    try {
      const client = await this.getClient();
      const key = `auth:login_attempts:${ipOrEmail}`;
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }
      return count;
    } catch (err) {
      logger.error({ err }, 'Failed to increment login attempts in Redis');
      return 0; // Fail open for resilience if Redis is down
    }
  }

  async getLoginAttempts(ipOrEmail: string): Promise<number> {
    try {
      const client = await this.getClient();
      const key = `auth:login_attempts:${ipOrEmail}`;
      const val = await client.get(key);
      return val ? parseInt(val, 10) : 0;
    } catch (err) {
      logger.error({ err }, 'Failed to get login attempts from Redis');
      return 0;
    }
  }

  async resetLoginAttempts(ipOrEmail: string): Promise<void> {
    try {
      const client = await this.getClient();
      const key = `auth:login_attempts:${ipOrEmail}`;
      await client.del(key);
    } catch (err) {
      logger.error({ err }, 'Failed to reset login attempts in Redis');
    }
  }

  // ─── User Session Blacklist Cache (Optional cache for revoked tokens) ────
  async blacklistToken(tokenHash: string, ttlSeconds: number): Promise<void> {
    try {
      const client = await this.getClient();
      const key = `auth:blacklist:${tokenHash}`;
      await client.setex(key, ttlSeconds, '1');
    } catch (err) {
      logger.error({ err }, 'Failed to blacklist token in Redis');
    }
  }

  async isTokenBlacklisted(tokenHash: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const key = `auth:blacklist:${tokenHash}`;
      const val = await client.get(key);
      return val === '1';
    } catch (err) {
      logger.error({ err }, 'Failed to check blacklisted token in Redis');
      return false;
    }
  }
}
