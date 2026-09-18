// apps/server/src/modules/rbac/rbac.repository.ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  organizationMemberships,
  rolePermissions,
  permissions,
  type Membership,
} from '@siteflow/database/schema';

export class RbacRepository {
  private get db() {
    return getDb();
  }

  async findActiveMembership(
    orgId: string,
    userId: string,
  ): Promise<Membership | undefined> {
    const result = await this.db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    return result[0];
  }

  async getPermissionsForRole(roleId: string): Promise<string[]> {
    const rows = await this.db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return rows.map((r) => r.key);
  }

  async getPermissionsForMembership(membershipId: string): Promise<string[]> {
    const membership = await this.db
      .select({ roleId: organizationMemberships.roleId })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.id, membershipId))
      .limit(1);

    if (!membership[0]) return [];

    return this.getPermissionsForRole(membership[0].roleId);
  }
}
