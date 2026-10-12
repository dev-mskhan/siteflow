// apps/server/src/modules/platform/platform-rbac.repository.ts
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import { getRedis } from '../../lib/redis/redis.js';
import {
  platformPermissions,
  platformRolePermissions,
  platformRoles,
  platformUserRoles,
  users,
} from '@siteflow/database/schema';

const PERMISSION_CACHE_TTL_SECONDS = 60;
const cacheKey = (userId: string) => `platform:perms:${userId}`;

export class PlatformRbacRepository {
  private get db() {
    return getDb();
  }

  /**
   * Cache is a short-TTL accelerator only. Grant/revoke invalidate it synchronously,
   * so a stale entry can live at most PERMISSION_CACHE_TTL_SECONDS after a DB change.
   */
  async hasPlatformPermission(userId: string, permissionKey: string): Promise<boolean> {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(userId));
    if (cached !== null) {
      return (JSON.parse(cached) as string[]).includes(permissionKey);
    }

    const keys = await this.loadPermissionKeys(userId);
    await redis.set(cacheKey(userId), JSON.stringify(keys), 'EX', PERMISSION_CACHE_TTL_SECONDS);
    return keys.includes(permissionKey);
  }

  private async loadPermissionKeys(userId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ key: platformPermissions.key })
      .from(platformUserRoles)
      .innerJoin(
        platformRolePermissions,
        eq(platformRolePermissions.platformRoleId, platformUserRoles.platformRoleId),
      )
      .innerJoin(
        platformPermissions,
        eq(platformPermissions.id, platformRolePermissions.platformPermissionId),
      )
      .where(and(eq(platformUserRoles.userId, userId), isNull(platformUserRoles.revokedAt)));
    return rows.map((r) => r.key);
  }

  async grantPlatformRole(userId: string, platformRoleId: string): Promise<void> {
    await this.db
      .insert(platformUserRoles)
      .values({ userId, platformRoleId })
      .onConflictDoNothing();
    await getRedis().del(cacheKey(userId));
  }

  async revokePlatformRole(userId: string, platformRoleId: string): Promise<void> {
    await this.db
      .update(platformUserRoles)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(platformUserRoles.userId, userId),
          eq(platformUserRoles.platformRoleId, platformRoleId),
          isNull(platformUserRoles.revokedAt),
        ),
      );
    await getRedis().del(cacheKey(userId));
  }

  /**
   * Grants platform_admin to the user whose email is PLATFORM_BOOTSTRAP_EMAIL.
   * Idempotent; a no-op when the env var is unset or the user does not exist yet.
   */
  async bootstrapPlatformOperator(email: string | undefined): Promise<boolean> {
    if (!email) return false;
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    const [role] = await this.db
      .select({ id: platformRoles.id })
      .from(platformRoles)
      .where(eq(platformRoles.key, 'platform_admin'))
      .limit(1);
    if (!user || !role) return false;
    await this.grantPlatformRole(user.id, role.id);
    return true;
  }
}
