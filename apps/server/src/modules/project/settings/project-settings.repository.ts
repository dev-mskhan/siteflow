// apps/server/src/modules/project/settings/project-settings.repository.ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { projectSettings, type ProjectSettings, type NewProjectSettings } from '@siteflow/database/schema';

export class ProjectSettingsRepository {
  private get db() {
    return getDb();
  }

  async findByProject(orgId: string, projectId: string): Promise<ProjectSettings | null> {
    const result = await this.db
      .select()
      .from(projectSettings)
      .where(
        and(
          eq(projectSettings.projectId, projectId),
          eq(projectSettings.organizationId, orgId),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  }

  async upsert(
    tx: any,
    orgId: string,
    projectId: string,
    data: Partial<Omit<NewProjectSettings, 'id' | 'projectId' | 'organizationId' | 'updatedAt'>>,
    settingsId?: string,
  ): Promise<ProjectSettings> {
    const existing = await this.findByProject(orgId, projectId);

    if (existing) {
      const result = await (tx ?? this.db)
        .update(projectSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(projectSettings.id, existing.id))
        .returning();
      return result[0]!;
    }

    const { generateId } = await import('../../../lib/id.js');
    const result = await (tx ?? this.db)
      .insert(projectSettings)
      .values({
        id: settingsId ?? generateId(),
        projectId,
        organizationId: orgId,
        ...data,
      })
      .returning();
    return result[0]!;
  }
}

export const projectSettingsRepository = new ProjectSettingsRepository();
