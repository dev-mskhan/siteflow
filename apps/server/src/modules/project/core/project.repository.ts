// apps/server/src/modules/project/core/project.repository.ts
import { eq, and, desc, or, lt, sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { projects, type Project, type NewProject } from '@siteflow/database/schema';
import { DocumentSequenceRepository } from '../../organization/sequences/sequences.repository.js';
import { ProjectNotFoundError, ProjectModifiedError } from './project.errors.js';
import type { ListProjectsFilter, ProjectStatus } from './project.types.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'project-repository' });
const sequenceRepo = new DocumentSequenceRepository();

export class ProjectRepository {
  private get db() {
    return getDb();
  }

  async create(tx: any, data: NewProject): Promise<Project> {
    const result = await tx.insert(projects).values(data).returning();
    return result[0]!;
  }

  async findById(orgId: string, projectId: string): Promise<Project | null> {
    const result = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
      .limit(1);
    return result[0] ?? null;
  }

  async findByIdOrThrow(orgId: string, projectId: string): Promise<Project> {
    const project = await this.findById(orgId, projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }
    return project;
  }

  async findAll(
    orgId: string,
    opts: ListProjectsFilter,
  ): Promise<{ rows: Project[]; nextCursor: string | null }> {
    const limit = opts.limit ?? 20;
    const fetchLimit = limit + 1; // fetch one extra to detect next page

    let cursor: { createdAt: Date; id: string } | null = null;
    if (opts.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(opts.cursor, 'base64').toString('utf8'));
        cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
      } catch {
        // invalid cursor — ignore, start from beginning
      }
    }

    const conditions = [eq(projects.organizationId, orgId)];

    if (opts.status) {
      conditions.push(eq(projects.status, opts.status));
    }

    if (opts.search) {
      conditions.push(
        or(
          sql`lower(${projects.name}) LIKE ${'%' + opts.search.toLowerCase() + '%'}`,
          sql`lower(${projects.projectNumber}) LIKE ${'%' + opts.search.toLowerCase() + '%'}`,
        )!,
      );
    }

    if (cursor) {
      // Stable descending cursor: rows where (createdAt < cursor.createdAt) OR (createdAt = cursor.createdAt AND id < cursor.id)
      conditions.push(
        or(
          lt(projects.createdAt, cursor.createdAt),
          and(
            sql`${projects.createdAt} = ${cursor.createdAt.toISOString()}`,
            lt(projects.id, cursor.id),
          ),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(fetchLimit);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      rows.pop();
      const last = rows[rows.length - 1]!;
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
      ).toString('base64');
    }

    return { rows, nextCursor };
  }

  /**
   * Optimistic update — increments version. Throws ProjectModifiedError if version mismatch.
   */
  async update(
    tx: any,
    orgId: string,
    projectId: string,
    data: Partial<Omit<Project, 'id' | 'organizationId' | 'projectNumber' | 'version' | 'createdAt'>>,
    expectedVersion: number,
  ): Promise<Project> {
    const result = await tx
      .update(projects)
      .set({ ...data, version: sql`${projects.version} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.organizationId, orgId),
          eq(projects.version, expectedVersion),
        ),
      )
      .returning();

    if (!result[0]) {
      logger.warn({ orgId, projectId, expectedVersion }, 'Optimistic concurrency conflict on project update');
      throw new ProjectModifiedError();
    }
    return result[0];
  }

  /**
   * Status update — used by lifecycle service (already holds FOR UPDATE lock).
   * No version check needed.
   */
  async updateStatus(
    tx: any,
    orgId: string,
    projectId: string,
    status: ProjectStatus,
    extraFields?: Partial<Pick<Project, 'actualStartDate' | 'actualEndDate'>>,
  ): Promise<Project> {
    const result = await tx
      .update(projects)
      .set({ status, updatedAt: new Date(), ...extraFields })
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
      .returning();

    if (!result[0]) {
      throw new ProjectNotFoundError();
    }
    return result[0];
  }

  /**
   * Pessimistic lock for lifecycle transitions.
   */
  async lockForUpdate(tx: any, orgId: string, projectId: string): Promise<Project> {
    const result = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
      .for('update')
      .limit(1);

    if (!result[0]) {
      throw new ProjectNotFoundError();
    }
    return result[0];
  }

  /**
   * Allocates the next project number using the document_sequences lock pattern.
   * MUST be called inside a transaction.
   */
  async generateProjectNumber(tx: any, orgId: string): Promise<string> {
    const { formatted } = await sequenceRepo.allocateNext(orgId, 'PROJECT', tx);
    return formatted;
  }
}

export const projectRepository = new ProjectRepository();
