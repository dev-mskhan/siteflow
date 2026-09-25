// apps/server/src/modules/organization/profile/profile.repository.ts
import { eq } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { organizationProfiles, type OrganizationProfile } from '@siteflow/database/schema';
import type { UpdateProfileInput } from './profile.types.js';

export class OrgProfileRepository {
  private get db() {
    return getDb();
  }

  async findByOrgId(orgId: string): Promise<OrganizationProfile | undefined> {
    const result = await this.db
      .select()
      .from(organizationProfiles)
      .where(eq(organizationProfiles.organizationId, orgId))
      .limit(1);
    return result[0];
  }

  async upsert(orgId: string, data: UpdateProfileInput, tx?: any): Promise<OrganizationProfile> {
    const client = tx ?? this.db;
    const result = await client
      .insert(organizationProfiles)
      .values({
        organizationId: orgId,
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: organizationProfiles.organizationId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0]!;
  }
}
