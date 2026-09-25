// apps/server/src/lib/redis/redis.ts
// Shared Redis singleton — all consumers call getRedis() instead of new Redis().
import { Redis } from 'ioredis';
import { serverEnv } from '../../config/env.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'redis' });

let _redisInstance: Redis | undefined;

/**
 * Returns the shared Redis client. Creates it on first call (lazy connect).
 * All modules — auth cache, RBAC cache, tenant job limiter — share this single connection pool.
 */
export function getRedis(): Redis {
  if (!_redisInstance) {
    _redisInstance = new Redis(serverEnv.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    _redisInstance.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection warning');
    });

    _redisInstance.on('connect', () => {
      logger.info('Redis connected');
    });

    _redisInstance.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }
  return _redisInstance;
}

/**
 * Ensures the Redis client is connected. Safe to call multiple times.
 * Falls back gracefully if Redis is unavailable.
 */
export async function ensureRedisConnected(): Promise<Redis> {
  const client = getRedis();
  if (client.status === 'wait') {
    await client.connect().catch((err) => {
      logger.warn({ err: err.message }, 'Redis lazy-connect failed — running without cache');
    });
  }
  return client;
}
