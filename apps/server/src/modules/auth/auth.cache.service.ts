// apps/server/src/modules/auth/auth.cache.service.ts
import { ensureRedisConnected } from '../../lib/redis/redis.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'auth-cache-service' });

export class AuthCacheService {
  // ─── Rate Limiting / Attempt Throttling ──────────────────────────────────

  async incrementLoginAttempts(ipOrEmail: string, ttlSeconds = 900): Promise<number> {
    try {
      const client = await ensureRedisConnected();
      const key = `auth:login_attempts:${ipOrEmail}`;
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
      const client = await ensureRedisConnected();
      const key = `auth:login_attempts:${ipOrEmail}`;
      await client.del(key);
    } catch (err) {
      logger.error({ err }, 'Failed to reset login attempts in Redis');
    }
  }
}
