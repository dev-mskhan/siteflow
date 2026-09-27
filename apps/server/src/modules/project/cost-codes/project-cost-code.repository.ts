// apps/server/src/modules/project/cost-codes/project-cost-code.repository.ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { projectCostCodes } from '@siteflow/database/schema';
import type { ProjectCostCode, NewProjectCostCode } from '@siteflow/database/schema';
import { NotFoundError } from '../../auth/auth.errors.js';

export class ProjectCostCodeRepository {
  private get db() {
    return getDb();
  }

  async create(tx: any, data: NewProjectCostCode): Promise<ProjectCostCode> {
    const result = await tx.insert(projectCostCodes).values(data).returning();
    return result[0]!;
  }

  async findAll(orgId: string, projectId: string, includeInactive = false): Promise<ProjectCostCode[]> {
    const conditions = [
      eq(projectCostCodes.organizationId, orgId),
      eq(projectCostCodes.projectId, projectId),
    ];
    if (!includeInactive) {
      conditions.push(eq(projectCostCodes.isActive, true));
    }
    return this.db.select().from(projectCostCodes).where(and(...conditions));
  }

  async findById(orgId: string, projectId: string, codeId: string): Promise<ProjectCostCode | null> {
    const result = await this.db
      .select()
      .from(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.id, codeId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.organizationId, orgId),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByIdOrThrow(orgId: string, projectId: string, codeId: string): Promise<ProjectCostCode> {
    const code = await this.findById(orgId, projectId, codeId);
    if (!code) throw new NotFoundError('Cost code not found');
    return code;
  }

  async update(
    tx: any,
    orgId: string,
    projectId: string,
    codeId: string,
    data: Partial<Pick<ProjectCostCode, 'code' | 'description'>>,
  ): Promise<ProjectCostCode> {
    const result = await tx
      .update(projectCostCodes)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(projectCostCodes.id, codeId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.organizationId, orgId),
        ),
      )
      .returning();
    return result[0]!;
  }

  async deactivate(tx: any, orgId: string, projectId: string, codeId: string): Promise<ProjectCostCode> {
    const result = await tx
      .update(projectCostCodes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(projectCostCodes.id, codeId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.organizationId, orgId),
        ),
      )
      .returning();
    return result[0]!;
  }
}

export const projectCostCodeRepository = new ProjectCostCodeRepository();
