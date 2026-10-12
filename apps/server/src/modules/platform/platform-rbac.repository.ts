// apps/server/src/modules/platform/platform-rbac.repository.ts
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  platformPermissions,
  platformRolePermissions,
  platformUserRoles,
} from '@siteflow/database/schema';

export class PlatformRbacRepository {
  private get db() {
    return getDb();
  }

  async hasPlatformPermission(userId: string, permissionKey: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: platformPermissions.id })
      .from(platformUserRoles)
      .innerJoin(
        platformRolePermissions,
        eq(platformRolePermissions.platformRoleId, platformUserRoles.platformRoleId),
      )
      .innerJoin(
        platformPermissions,
        eq(platformPermissions.id, platformRolePermissions.platformPermissionId),
      )
      .where(
        and(
          eq(platformUserRoles.userId, userId),
          isNull(platformUserRoles.revokedAt),
          eq(platformPermissions.key, permissionKey),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async grantPlatformRole(userId: string, platformRoleId: string): Promise<void> {
    await this.db
      .insert(platformUserRoles)
      .values({ userId, platformRoleId })
      .onConflictDoNothing();
  }
}
