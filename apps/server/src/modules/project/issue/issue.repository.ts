// apps/server/src/modules/project/issue/issue.repository.ts
import { issues, type Issue } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';

export class IssueRepository {
  async findById(db: any, id: string): Promise<Issue | undefined> {
    const rows = await db.select().from(issues).where(eq(issues.id, id));
    return rows[0];
  }

  async listByProject(db: any, organizationId: string, projectId: string): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .where(and(eq(issues.organizationId, organizationId), eq(issues.projectId, projectId)));
  }

  async create(
    db: any,
    data: {
      id: string;
      organizationId: string;
      projectId: string;
      title: string;
      description?: string;
      reportedImpactDays: number;
      assignedTo?: string;
    },
  ): Promise<Issue> {
    const rows = await db.insert(issues).values(data).returning();
    return rows[0]!;
  }

  async update(
    db: any,
    id: string,
    patch: {
      title?: string;
      description?: string;
      reportedImpactDays?: number;
      approvedImpactDays?: number;
      assignedTo?: string | null;
      status?: string;
    },
  ): Promise<Issue> {
    const rows = await db.update(issues).set(patch).where(eq(issues.id, id)).returning();
    return rows[0]!;
  }
}
