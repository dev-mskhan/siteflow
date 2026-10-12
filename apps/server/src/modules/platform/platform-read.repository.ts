// apps/server/src/modules/platform/platform-read.repository.ts
import { and, desc, eq, inArray, lt, or, ilike, ne, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  organizations,
  organizationMemberships,
  roles,
  users,
  type Organization,
} from '@siteflow/database/schema';

export interface PlatformCursor {
  createdAt: Date;
  id: string;
}

export interface PlatformOrgRow {
  id: string;
  name: string;
  slug: string;
  status: Organization['status'];
  createdAt: Date;
  memberCount: number;
  ownerUserId: string | null;
  ownerEmailMasked: string | null;
}

export interface PlatformAccountRow {
  id: string;
  emailMasked: string;
  firstName: string;
  lastName: string | null;
  status: string;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  membershipCount: number;
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local.charAt(0)}***@${domain}`;
}

export class PlatformReadRepository {
  private get db() {
    return getDb();
  }

  /**
   * Keyset-paginated organization listing. Owner and member count are resolved
   * with two batched queries for the page, never per row.
   */
  async listOrganizations(params: {
    limit: number;
    cursor?: PlatformCursor;
    search?: string;
  }): Promise<{ rows: PlatformOrgRow[]; hasMore: boolean }> {
    const conditions: SQL[] = [];
    if (params.cursor) {
      conditions.push(
        or(
          lt(organizations.createdAt, params.cursor.createdAt),
          and(
            eq(organizations.createdAt, params.cursor.createdAt),
            lt(organizations.id, params.cursor.id),
          ),
        )!,
      );
    }
    if (params.search) {
      conditions.push(ilike(organizations.slug, `${params.search.toLowerCase()}%`));
    }

    const orgs = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(organizations.createdAt), desc(organizations.id))
      .limit(params.limit + 1);

    const hasMore = orgs.length > params.limit;
    const page = orgs.slice(0, params.limit);
    if (page.length === 0) return { rows: [], hasMore };

    const orgIds = page.map((o) => o.id);

    const counts = await this.db
      .select({
        organizationId: organizationMemberships.organizationId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(organizationMemberships)
      .where(
        and(
          inArray(organizationMemberships.organizationId, orgIds),
          ne(organizationMemberships.status, 'REMOVED'),
        ),
      )
      .groupBy(organizationMemberships.organizationId);

    // Owner = membership holding the system "Organization Admin" role.
    const owners = await this.db
      .select({
        organizationId: organizationMemberships.organizationId,
        userId: users.id,
        email: users.email,
        joinedAt: organizationMemberships.joinedAt,
        createdAt: organizationMemberships.createdAt,
      })
      .from(organizationMemberships)
      .innerJoin(roles, eq(roles.id, organizationMemberships.roleId))
      .innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(
        and(
          inArray(organizationMemberships.organizationId, orgIds),
          eq(roles.name, 'Organization Admin'),
          eq(roles.isSystem, true),
          ne(organizationMemberships.status, 'REMOVED'),
        ),
      );

    const countMap = new Map(counts.map((c) => [c.organizationId, c.count]));
    const ownerMap = new Map<string, (typeof owners)[number]>();
    for (const o of owners) {
      const existing = ownerMap.get(o.organizationId);
      if (!existing || o.createdAt < existing.createdAt) ownerMap.set(o.organizationId, o);
    }

    const rows: PlatformOrgRow[] = page.map((o) => {
      const owner = ownerMap.get(o.id);
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        status: o.status,
        createdAt: o.createdAt,
        memberCount: countMap.get(o.id) ?? 0,
        ownerUserId: owner?.userId ?? null,
        ownerEmailMasked: owner ? maskEmail(owner.email) : null,
      };
    });

    return { rows, hasMore };
  }

  /** Keyset-paginated account listing with masked email and no credential fields. */
  async listAccounts(params: {
    limit: number;
    cursor?: PlatformCursor;
    emailPrefix?: string;
  }): Promise<{ rows: PlatformAccountRow[]; hasMore: boolean }> {
    const conditions: SQL[] = [];
    if (params.cursor) {
      conditions.push(
        or(
          lt(users.createdAt, params.cursor.createdAt),
          and(eq(users.createdAt, params.cursor.createdAt), lt(users.id, params.cursor.id)),
        )!,
      );
    }
    if (params.emailPrefix) {
      // Prefix match on lower(email) so the users_email_unique_lower index can be used.
      conditions.push(sql`lower(${users.email}) like ${params.emailPrefix.toLowerCase() + '%'}`);
    }

    const accts = await this.db
      .select({
        id: users.id,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(params.limit + 1);

    const hasMore = accts.length > params.limit;
    const page = accts.slice(0, params.limit);
    if (page.length === 0) return { rows: [], hasMore };

    const counts = await this.db
      .select({
        userId: organizationMemberships.userId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(organizationMemberships)
      .where(
        and(
          inArray(
            organizationMemberships.userId,
            page.map((a) => a.id),
          ),
          ne(organizationMemberships.status, 'REMOVED'),
        ),
      )
      .groupBy(organizationMemberships.userId);

    const countMap = new Map(counts.map((c) => [c.userId, c.count]));

    const rows: PlatformAccountRow[] = page.map((a) => ({
      id: a.id,
      emailMasked: maskEmail(a.email),
      firstName: a.firstName,
      lastName: a.lastName,
      status: a.status,
      emailVerified: a.emailVerifiedAt !== null,
      lastLoginAt: a.lastLoginAt,
      createdAt: a.createdAt,
      membershipCount: countMap.get(a.id) ?? 0,
    }));

    return { rows, hasMore };
  }
}
