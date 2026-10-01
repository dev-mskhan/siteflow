// apps/server/src/modules/membership/membership.repository.ts
import { eq, and, ne, sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  organizationMemberships,
  users,
  roles,
  type Membership,
  type NewMembership,
} from '@siteflow/database/schema';

export type MemberWithDetails = Membership & {
  userEmail: string;
  userFirstName: string;
  userLastName: string | null;
  roleName: string;
};

export class MembershipRepository {
  private get db() {
    return getDb();
  }

  async findById(id: string, orgId?: string): Promise<Membership | undefined> {
    const conditions = orgId
      ? and(eq(organizationMemberships.id, id), eq(organizationMemberships.organizationId, orgId))
      : eq(organizationMemberships.id, id);

    const result = await this.db
      .select()
      .from(organizationMemberships)
      .where(conditions)
      .limit(1);
    return result[0];
  }

  async findByOrgAndUser(orgId: string, userId: string): Promise<Membership | undefined> {
    const result = await this.db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.userId, userId),
          ne(organizationMemberships.status, 'REMOVED'),
        ),
      )
      .limit(1);
    return result[0];
  }

  async findByOrg(orgId: string): Promise<MemberWithDetails[]> {
    const rows = await this.db
      .select({
        membership: organizationMemberships,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        roleName: roles.name,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .innerJoin(roles, eq(organizationMemberships.roleId, roles.id))
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          ne(organizationMemberships.status, 'REMOVED'),
        ),
      );

    return rows.map((r) => ({
      ...r.membership,
      userEmail: r.userEmail,
      userFirstName: r.userFirstName,
      userLastName: r.userLastName,
      roleName: r.roleName,
    }));
  }

  async findMemberWithDetails(id: string, orgId?: string): Promise<MemberWithDetails | undefined> {
    const conditions = orgId
      ? and(eq(organizationMemberships.id, id), eq(organizationMemberships.organizationId, orgId))
      : eq(organizationMemberships.id, id);

    const rows = await this.db
      .select({
        membership: organizationMemberships,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        roleName: roles.name,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .innerJoin(roles, eq(organizationMemberships.roleId, roles.id))
      .where(conditions)
      .limit(1);

    if (!rows[0]) return undefined;

    return {
      ...rows[0].membership,
      userEmail: rows[0].userEmail,
      userFirstName: rows[0].userFirstName,
      userLastName: rows[0].userLastName,
      roleName: rows[0].roleName,
    };
  }

  async countActiveAdmins(orgId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(organizationMemberships)
      .innerJoin(roles, eq(organizationMemberships.roleId, roles.id))
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.status, 'ACTIVE'),
          eq(roles.name, 'Organization Admin'),
        ),
      );

    return result[0]?.count ?? 0;
  }

  async update(id: string, data: Partial<NewMembership>, tx?: any): Promise<Membership> {
    const client = tx ?? this.db;
    const result = await client
      .update(organizationMemberships)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(organizationMemberships.id, id))
      .returning();
    return result[0]!;
  }

  async findByIdForUpdate(tx: any, memberId: string, orgId: string): Promise<Membership | undefined> {
    const rows = await tx.execute(
      sql`SELECT id, organization_id, user_id, role_id, status, joined_at, created_at, updated_at
          FROM app.organization_memberships 
          WHERE id = ${memberId} AND organization_id = ${orgId} FOR UPDATE`,
    ) as any;
    const row = (rows.rows ?? rows)[0];
    if (!row) return undefined;
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      roleId: row.role_id,
      status: row.status,
      joinedAt: row.joined_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as Membership;
  }

  async softRemove(id: string, tx?: any): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(organizationMemberships)
      .set({
        status: 'REMOVED',
        updatedAt: new Date(),
      })
      .where(eq(organizationMemberships.id, id));
  }
}
