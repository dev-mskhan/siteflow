// apps/server/src/modules/project/subcontractor/subcontractor.repository.ts
import {
  subcontractors,
  subcontractorContacts,
  projectSubcontractors,
  subcontractorTaskAssignments,
  type Subcontractor,
  type SubcontractorContact,
  type ProjectSubcontractor,
  type SubcontractorTaskAssignment,
} from '@siteflow/database/schema';
import { eq, and, lt, or, desc } from 'drizzle-orm';

export class SubcontractorRepository {
  async findById(db: any, id: string): Promise<Subcontractor | undefined> {
    const rows = await db.select().from(subcontractors).where(eq(subcontractors.id, id));
    return rows[0];
  }

  async create(
    db: any,
    data: {
      id: string;
      organizationId: string;
      legalName: string;
      displayName: string;
      trade?: string;
      registrationReference?: string;
      taxReference?: string;
      primaryEmail?: string;
      primaryPhone?: string;
      address?: string;
      notes?: string;
    },
  ): Promise<Subcontractor> {
    const rows = await db.insert(subcontractors).values(data).returning();
    return rows[0]!;
  }

  async update(
    db: any,
    id: string,
    patch: Partial<{
      legalName: string;
      displayName: string;
      trade: string;
      registrationReference: string;
      taxReference: string;
      status: string;
      primaryEmail: string | null;
      primaryPhone: string;
      address: string;
      notes: string;
    }>,
  ): Promise<Subcontractor> {
    const rows = await db.update(subcontractors).set(patch).where(eq(subcontractors.id, id)).returning();
    return rows[0]!;
  }

  async listByOrg(
    db: any,
    organizationId: string,
    opts: { cursor?: string; limit: number; status?: string },
  ): Promise<Subcontractor[]> {
    const conditions: any[] = [eq(subcontractors.organizationId, organizationId)];

    if (opts.status) {
      conditions.push(eq(subcontractors.status, opts.status as any));
    }

    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(Buffer.from(opts.cursor, 'base64').toString());
        conditions.push(
          or(
            lt(subcontractors.createdAt, new Date(createdAt)),
            and(eq(subcontractors.createdAt, new Date(createdAt)), lt(subcontractors.id, id)),
          ) as any,
        );
      } catch {
        // ignore invalid cursor
      }
    }

    return db
      .select()
      .from(subcontractors)
      .where(and(...conditions))
      .orderBy(desc(subcontractors.createdAt), desc(subcontractors.id))
      .limit(opts.limit);
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  async findContactById(db: any, id: string): Promise<SubcontractorContact | undefined> {
    const rows = await db.select().from(subcontractorContacts).where(eq(subcontractorContacts.id, id));
    return rows[0];
  }

  async findPrimaryContact(db: any, subcontractorId: string): Promise<SubcontractorContact | undefined> {
    const rows = await db
      .select()
      .from(subcontractorContacts)
      .where(
        and(
          eq(subcontractorContacts.subcontractorId, subcontractorId),
          eq(subcontractorContacts.isPrimary, true),
        ),
      );
    return rows[0];
  }

  async createContact(
    db: any,
    data: {
      id: string;
      organizationId: string;
      subcontractorId: string;
      name: string;
      role?: string;
      email?: string;
      phone?: string;
      isPrimary: boolean;
    },
  ): Promise<SubcontractorContact> {
    const rows = await db.insert(subcontractorContacts).values(data).returning();
    return rows[0]!;
  }

  async updateContact(
    db: any,
    id: string,
    patch: Partial<{
      name: string;
      role: string;
      email: string | null;
      phone: string;
      isPrimary: boolean;
      isActive: boolean;
    }>,
  ): Promise<SubcontractorContact> {
    const rows = await db
      .update(subcontractorContacts)
      .set(patch)
      .where(eq(subcontractorContacts.id, id))
      .returning();
    return rows[0]!;
  }

  async listContactsBySubcontractor(db: any, subcontractorId: string): Promise<SubcontractorContact[]> {
    return db
      .select()
      .from(subcontractorContacts)
      .where(eq(subcontractorContacts.subcontractorId, subcontractorId));
  }

  // ── Project assignments ────────────────────────────────────────────────────

  async findProjectSubcontractor(
    db: any,
    projectId: string,
    subcontractorId: string,
  ): Promise<ProjectSubcontractor | undefined> {
    const rows = await db
      .select()
      .from(projectSubcontractors)
      .where(
        and(
          eq(projectSubcontractors.projectId, projectId),
          eq(projectSubcontractors.subcontractorId, subcontractorId),
        ),
      );
    return rows[0];
  }

  async findProjectSubcontractorById(db: any, id: string): Promise<ProjectSubcontractor | undefined> {
    const rows = await db
      .select()
      .from(projectSubcontractors)
      .where(eq(projectSubcontractors.id, id));
    return rows[0];
  }

  async createProjectSubcontractor(
    db: any,
    data: {
      id: string;
      organizationId: string;
      projectId: string;
      subcontractorId: string;
      scopeDescription?: string;
      contractValue?: string;
      currencyCode?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<ProjectSubcontractor> {
    const rows = await db.insert(projectSubcontractors).values(data).returning();
    return rows[0]!;
  }

  async updateProjectSubcontractor(
    db: any,
    id: string,
    patch: Partial<{
      status: string;
      scopeDescription: string;
      contractValue: string | null;
      currencyCode: string;
      startDate: string | null;
      endDate: string | null;
    }>,
  ): Promise<ProjectSubcontractor> {
    const rows = await db
      .update(projectSubcontractors)
      .set(patch)
      .where(eq(projectSubcontractors.id, id))
      .returning();
    return rows[0]!;
  }

  async listProjectSubcontractors(
    db: any,
    organizationId: string,
    projectId: string,
  ): Promise<ProjectSubcontractor[]> {
    return db
      .select()
      .from(projectSubcontractors)
      .where(
        and(
          eq(projectSubcontractors.organizationId, organizationId),
          eq(projectSubcontractors.projectId, projectId),
        ),
      );
  }

  // ── Task assignments ────────────────────────────────────────────────────────

  async findTaskAssignment(
    db: any,
    subcontractorId: string,
    taskId: string,
  ): Promise<SubcontractorTaskAssignment | undefined> {
    const rows = await db
      .select()
      .from(subcontractorTaskAssignments)
      .where(
        and(
          eq(subcontractorTaskAssignments.subcontractorId, subcontractorId),
          eq(subcontractorTaskAssignments.taskId, taskId),
        ),
      );
    return rows[0];
  }

  async createTaskAssignment(
    db: any,
    data: {
      id: string;
      organizationId: string;
      projectId: string;
      subcontractorId: string;
      taskId: string;
      assignmentRole?: string;
    },
  ): Promise<SubcontractorTaskAssignment> {
    const rows = await db.insert(subcontractorTaskAssignments).values(data).returning();
    return rows[0]!;
  }

  async deleteTaskAssignment(db: any, subcontractorId: string, taskId: string): Promise<void> {
    await db
      .delete(subcontractorTaskAssignments)
      .where(
        and(
          eq(subcontractorTaskAssignments.subcontractorId, subcontractorId),
          eq(subcontractorTaskAssignments.taskId, taskId),
        ),
      );
  }

  async listTaskAssignments(
    db: any,
    projectId: string,
    subcontractorId: string,
  ): Promise<SubcontractorTaskAssignment[]> {
    return db
      .select()
      .from(subcontractorTaskAssignments)
      .where(
        and(
          eq(subcontractorTaskAssignments.projectId, projectId),
          eq(subcontractorTaskAssignments.subcontractorId, subcontractorId),
        ),
      );
  }
}
