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

export async function deleteRedisKeysByPattern(
  client: Redis,
  pattern: string,
  options: { count?: number; maxBatches?: number; maxKeys?: number } = {},
): Promise<number> {
  const count = options.count ?? 100;
  const maxBatches = options.maxBatches ?? 1_000;
  const maxKeys = options.maxKeys ?? 100_000;
  let cursor = '0';
  let batches = 0;
  let deleted = 0;

  do {
    if (batches >= maxBatches) {
      throw new Error(`Redis scan exceeded ${maxBatches} batches for pattern ${pattern}`);
    }
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', count);
    cursor = nextCursor;
    batches += 1;
    if (deleted + keys.length > maxKeys) {
      throw new Error(`Redis scan exceeded ${maxKeys} keys for pattern ${pattern}`);
    }
    if (keys.length > 0) deleted += await client.del(...keys);
  } while (cursor !== '0');

  return deleted;
}
