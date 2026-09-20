// apps/server/src/modules/rbac/rbac.repository.ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  organizationMemberships,
  organizations,
  rolePermissions,
  permissions,
  type Membership,
} from '@siteflow/database/schema';

export class RbacRepository {
  private get db() {
    return getDb();
  }

  async findActiveMembershipWithOrgStatus(
    orgId: string,
    userId: string,
  ): Promise<{ membership: Membership; orgStatus: string } | undefined> {
    const result = await this.db
      .select({
        membership: organizationMemberships,
        orgStatus: organizations.status,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (!result[0]) return undefined;
    return {
      membership: result[0].membership,
      orgStatus: result[0].orgStatus,
    };
  }

  async findActiveMembership(
    orgId: string,
    userId: string,
  ): Promise<Membership | undefined> {
    const res = await this.findActiveMembershipWithOrgStatus(orgId, userId);
    return res?.membership;
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
