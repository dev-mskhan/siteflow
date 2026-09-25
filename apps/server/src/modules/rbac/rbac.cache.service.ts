// apps/server/src/modules/rbac/rbac.cache.service.ts
import { ensureRedisConnected } from '../../lib/redis/redis.js';

const PERMISSION_CACHE_TTL_SECONDS = 600; // 10 minutes

export class RbacCacheService {
  private key(orgId: string, userId: string): string {
    return `org:${orgId}:user:${userId}:permissions`;
  }

  /** Returns cached permissions, or null on miss or Redis unavailability. */
  async getPermissions(orgId: string, userId: string): Promise<string[] | null> {
    try {
      const r = await ensureRedisConnected();
      const val = await r.get(this.key(orgId, userId));
      if (!val) return null;
      return JSON.parse(val) as string[];
    } catch {
      return null; // fail-open: caller falls back to DB
    }
  }

  /** Caches the permission set. Silently swallows errors. */
  async setPermissions(orgId: string, userId: string, perms: string[]): Promise<void> {
    try {
      const r = await ensureRedisConnected();
      await r.setex(this.key(orgId, userId), PERMISSION_CACHE_TTL_SECONDS, JSON.stringify(perms));
    } catch {
      // fail-open: cache is optional
    }
  }

  /** Invalidates a single user's permission cache for an org. */
  async invalidate(orgId: string, userId: string): Promise<void> {
    try {
      const r = await ensureRedisConnected();
      await r.del(this.key(orgId, userId));
    } catch {
      // fail-open
    }
  }

  /**
   * Invalidates all permission cache entries for an org (e.g. role perms changed).
   * Uses SCAN to avoid blocking Redis with KEYS.
   */
  async invalidateOrg(orgId: string): Promise<void> {
    try {
      const r = await ensureRedisConnected();
      const pattern = `org:${orgId}:user:*:permissions`;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await r.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // fail-open
    }
  }
}

export const rbacCacheService = new RbacCacheService();
