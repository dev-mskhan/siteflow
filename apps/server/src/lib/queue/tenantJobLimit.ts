import { randomUUID } from 'node:crypto';
import { ensureRedisConnected } from '../redis/redis.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'tenant-job-limit' });

const ACQUIRE_LEASE = `
local time = redis.call('TIME')
local now = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then
  return 0
end
redis.call('ZADD', KEYS[1], now + tonumber(ARGV[3]), ARGV[2])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[3]) + 60000)
return 1
`;

const RELEASE_LEASE = `
if ARGV[1] ~= 'redis-unavailable' then
  redis.call('ZREM', KEYS[1], ARGV[1])
end
return 1
`;

function tenantLeaseKey(queue: string, tenantId: string): string {
  return `queue:tenant_active:${queue}:${tenantId}`;
}

export async function acquireTenantJobLease(
  queue: string,
  tenantId: string,
  maxConcurrentJobs: number,
  leaseMs: number,
): Promise<{ key: string; token: string } | null> {
  const key = tenantLeaseKey(queue, tenantId);
  const token = randomUUID();
  try {
    const redis = await ensureRedisConnected();
    const acquired = await redis.eval(
      ACQUIRE_LEASE,
      1,
      key,
      String(maxConcurrentJobs),
      token,
      String(leaseMs),
    );
    return Number(acquired) === 1 ? { key, token } : null;
  } catch (err) {
    logger.error({ err, queue, tenantId }, 'Tenant job lease unavailable; relying on worker concurrency cap');
    return { key, token: 'redis-unavailable' };
  }
}

export async function releaseTenantJobLease(lease: { key: string; token: string }): Promise<void> {
  if (lease.token === 'redis-unavailable') return;
  try {
    const redis = await ensureRedisConnected();
    await redis.eval(RELEASE_LEASE, 1, lease.key, lease.token);
  } catch (err) {
    logger.error({ err, leaseKey: lease.key }, 'Failed to release tenant job lease; lease will expire');
  }
}
