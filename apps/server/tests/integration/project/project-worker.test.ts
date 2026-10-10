import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisState = vi.hoisted(() => new Map<string, string>());
const redisCommands = vi.hoisted(() => ({
  get: vi.fn(async (key: string) => redisState.get(key) ?? null),
  set: vi.fn(async (key: string, value: string) => {
    redisState.set(key, value);
    return 'OK';
  }),
  incr: vi.fn(async (key: string) => {
    const next = Number(redisState.get(key) ?? '0') + 1;
    redisState.set(key, String(next));
    return next;
  }),
  del: vi.fn(async (...keys: string[]) => {
    for (const key of keys) redisState.delete(key);
    return keys.length;
  }),
  keys: vi.fn(async () => []),
}));

vi.mock('../../../src/lib/redis/redis.js', () => ({
  ensureRedisConnected: vi.fn(async () => redisCommands),
}));

import { ProjectCacheService } from '../../../src/modules/project/core/project.cache.service.js';

describe('project list cache generation invalidation', () => {
  beforeEach(() => {
    redisState.clear();
    vi.clearAllMocks();
  });

  it('invalidates bounded organization list keys by advancing their generation', async () => {
    const cache = new ProjectCacheService();
    const filter = { limit: 20 };
    const value = { data: [], nextCursor: null };

    const lookup = await cache.getProjectList('org-a', filter);
    expect(lookup.generation).toBe('0');
    await cache.setProjectList('org-a', filter, value, lookup.generation);
    expect((await cache.getProjectList('org-a', filter)).result).toEqual(value);

    await cache.invalidateOrgProjectLists('org-a');

    const invalidated = await cache.getProjectList('org-a', filter);
    expect(invalidated.generation).toBe('1');
    expect(invalidated.result).toBeNull();
    expect(redisCommands.keys).not.toHaveBeenCalled();
  });

  it('does not publish a stale list result after its organization generation changes', async () => {
    const cache = new ProjectCacheService();
    const filter = { status: 'ACTIVE' };
    const lookup = await cache.getProjectList('org-a', filter);

    await cache.invalidateOrgProjectLists('org-a');
    await cache.setProjectList('org-a', filter, { data: [], nextCursor: null }, lookup.generation);

    expect((await cache.getProjectList('org-a', filter)).result).toBeNull();
  });
});
