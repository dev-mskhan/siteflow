// apps/server/src/lib/queue/tenantJobLimit.ts
import { ensureRedisConnected } from '../redis/redis.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'tenant-job-limit' });

const MAX_CONCURRENT_TENANT_JOBS = 50;

export function jobCountKey(tenantId: string): string {
  return `queue:tenant_jobs:${tenantId}`;
}

export async function canStartJob(tenantId: string): Promise<boolean> {
  try {
    const redis = await ensureRedisConnected();
    const val = await redis.get(jobCountKey(tenantId));
    const current = val ? parseInt(val, 10) : 0;
    return current < MAX_CONCURRENT_TENANT_JOBS;
  } catch (err) {
    logger.error({ err, tenantId }, 'Failed to check tenant job limit in Redis');
    return true; // Fail open if Redis is down
  }
}

export async function incrementJobCount(tenantId: string, ttlSeconds = 60): Promise<number> {
  try {
    const redis = await ensureRedisConnected();
    const key = jobCountKey(tenantId);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  } catch (err) {
    logger.error({ err, tenantId }, 'Failed to increment tenant job count in Redis');
    return 0;
  }
}
