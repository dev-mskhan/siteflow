// apps/server/src/modules/organization/settings/settings.repository.ts
import { eq } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { organizationSettings, type OrganizationSettings } from '@siteflow/database/schema';
import type { UpdateSettingsInput } from './settings.types.js';

export class OrgSettingsRepository {
  private get db() {
    return getDb();
  }

  async findByOrgId(orgId: string): Promise<OrganizationSettings | undefined> {
    const result = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1);
    return result[0];
  }

  async upsert(orgId: string, data: UpdateSettingsInput, tx?: any): Promise<OrganizationSettings> {
    const client = tx ?? this.db;
    const result = await client
      .insert(organizationSettings)
      .values({
        organizationId: orgId,
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0]!;
  }
}
