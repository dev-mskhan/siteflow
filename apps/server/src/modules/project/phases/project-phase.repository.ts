// apps/server/src/modules/project/phases/project-phase.repository.ts
import { eq, and, asc, max } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { projectPhases, type ProjectPhase, type NewProjectPhase } from '@siteflow/database/schema';
import { NotFoundError } from '../../auth/auth.errors.js';

export class ProjectPhaseRepository {
  private get db() {
    return getDb();
  }

  async create(tx: any, data: NewProjectPhase): Promise<ProjectPhase> {
    const result = await tx.insert(projectPhases).values(data).returning();
    return result[0]!;
  }

  async findAll(
    orgId: string,
    projectId: string,
    includeArchived = false,
  ): Promise<ProjectPhase[]> {
    const conditions = [
      eq(projectPhases.organizationId, orgId),
      eq(projectPhases.projectId, projectId),
    ];
    if (!includeArchived) {
      conditions.push(eq(projectPhases.status, 'ACTIVE'));
    }
    return this.db
      .select()
      .from(projectPhases)
      .where(and(...conditions))
      .orderBy(asc(projectPhases.sortOrder));
  }

  async findById(orgId: string, projectId: string, phaseId: string): Promise<ProjectPhase | null> {
    const result = await this.db
      .select()
      .from(projectPhases)
      .where(
        and(
          eq(projectPhases.id, phaseId),
          eq(projectPhases.projectId, projectId),
          eq(projectPhases.organizationId, orgId),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByIdOrThrow(orgId: string, projectId: string, phaseId: string): Promise<ProjectPhase> {
    const phase = await this.findById(orgId, projectId, phaseId);
    if (!phase) throw new NotFoundError('Project phase not found');
    return phase;
  }

  async update(
    tx: any,
    orgId: string,
    projectId: string,
    phaseId: string,
    data: Partial<Pick<ProjectPhase, 'name' | 'description' | 'startsAt' | 'endsAt' | 'sortOrder'>>,
  ): Promise<ProjectPhase> {
    const result = await tx
      .update(projectPhases)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(projectPhases.id, phaseId),
          eq(projectPhases.projectId, projectId),
          eq(projectPhases.organizationId, orgId),
        ),
      )
      .returning();
    return result[0]!;
  }

  /** Soft-archive: sets status = 'ARCHIVED', never hard deletes. */
  async archive(tx: any, orgId: string, projectId: string, phaseId: string): Promise<ProjectPhase> {
    const result = await tx
      .update(projectPhases)
      .set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(
        and(
          eq(projectPhases.id, phaseId),
          eq(projectPhases.projectId, projectId),
          eq(projectPhases.organizationId, orgId),
        ),
      )
      .returning();
    return result[0]!;
  }

  async getMaxSortOrder(orgId: string, projectId: string): Promise<number> {
    const result = await this.db
      .select({ maxOrder: max(projectPhases.sortOrder) })
      .from(projectPhases)
      .where(
        and(
          eq(projectPhases.organizationId, orgId),
          eq(projectPhases.projectId, projectId),
          eq(projectPhases.status, 'ACTIVE'),
        ),
      );
    return result[0]?.maxOrder ?? -1;
  }

  async batchUpdateSortOrder(
    tx: any,
    updates: Array<{ id: string; sortOrder: number }>,
  ): Promise<void> {
    for (const { id, sortOrder } of updates) {
      await tx
        .update(projectPhases)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(projectPhases.id, id));
    }
  }
}

export const projectPhaseRepository = new ProjectPhaseRepository();
