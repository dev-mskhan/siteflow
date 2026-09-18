// apps/server/src/modules/organization/organization.repository.ts
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import {
  organizations,
  organizationMemberships,
  type Organization,
  type NewOrganization,
} from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'organization-repository' });

export class OrganizationRepository {
  private get db() {
    return getDb();
  }

  async findById(id: string): Promise<Organization | undefined> {
    const result = await this.db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return result[0];
  }

  async findBySlug(slug: string): Promise<Organization | undefined> {
    const result = await this.db.select().from(organizations).where(eq(organizations.slug, slug.toLowerCase())).limit(1);
    return result[0];
  }

  async listByUserId(userId: string): Promise<Organization[]> {
    const userMemberships = await this.db
      .select({ organizationId: organizationMemberships.organizationId })
      .from(organizationMemberships)
      .where(
        eq(organizationMemberships.userId, userId),
      );

    if (userMemberships.length === 0) return [];

    const orgIds = userMemberships.map((m) => m.organizationId);
    return this.db
      .select()
      .from(organizations)
      .where(inArray(organizations.id, orgIds));
  }

  async create(data: NewOrganization, tx?: any): Promise<Organization> {
    logger.debug({ name: data.name, slug: data.slug }, 'Creating organization');
    const client = tx ?? this.db;
    const result = await client
      .insert(organizations)
      .values({
        ...data,
        slug: data.slug.toLowerCase(),
      })
      .returning();
    return result[0]!;
  }

  async update(id: string, data: Partial<NewOrganization>, tx?: any): Promise<Organization | undefined> {
    const client = tx ?? this.db;
    const result = await client
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();
    return result[0];
  }
}
