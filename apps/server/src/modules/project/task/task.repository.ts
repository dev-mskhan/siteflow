// apps/server/src/modules/project/task/task.repository.ts
import { eq, and, sql, asc, like, count } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { tasks, type Task, type NewTask } from '@siteflow/database/schema';
import { TaskNotFoundError, TaskModifiedError } from './task.errors.js';
import type { TaskFilter } from './task.types.js';

export class TaskRepository {
  private get db() {
    return getDb();
  }

  async create(tx: any, data: NewTask): Promise<Task> {
    const db = tx ?? this.db;
    const result = await db.insert(tasks).values(data).returning();
    return result[0]!;
  }

  async findById(orgId: string, projectId: string, taskId: string): Promise<Task | null> {
    const result = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.projectId, projectId),
          eq(tasks.organizationId, orgId),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByIdOrThrow(orgId: string, projectId: string, taskId: string): Promise<Task> {
    const task = await this.findById(orgId, projectId, taskId);
    if (!task) throw new TaskNotFoundError();
    return task;
  }

  async findByCode(orgId: string, projectId: string, taskCode: string): Promise<Task | null> {
    const result = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.taskCode, taskCode),
          eq(tasks.projectId, projectId),
          eq(tasks.organizationId, orgId),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findMaxPosition(orgId: string, projectId: string): Promise<number> {
    const result = await this.db
      .select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), 0)` })
      .from(tasks)
      .where(and(eq(tasks.organizationId, orgId), eq(tasks.projectId, projectId)));
    return result[0]?.maxPos ?? 0;
  }

  async countByProject(orgId: string, projectId: string): Promise<number> {
    const result = await this.db
      .select({ total: count() })
      .from(tasks)
      .where(and(eq(tasks.organizationId, orgId), eq(tasks.projectId, projectId)));
    return Number(result[0]?.total ?? 0);
  }

  async findChildTasks(orgId: string, projectId: string, parentTaskId: string): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, orgId),
          eq(tasks.projectId, projectId),
          eq(tasks.parentTaskId, parentTaskId),
        ),
      )
      .orderBy(asc(tasks.position));
  }

  async findAll(
    orgId: string,
    projectId: string,
    filter: TaskFilter,
  ): Promise<{ items: Task[]; nextCursor: string | null; totalCount: number }> {
    const conditions = [
      eq(tasks.organizationId, orgId),
      eq(tasks.projectId, projectId),
    ];

    if (filter.status) {
      conditions.push(eq(tasks.status, filter.status));
    }
    if (filter.priority) {
      conditions.push(eq(tasks.priority, filter.priority));
    }
    if (filter.taskType) {
      conditions.push(eq(tasks.taskType, filter.taskType));
    }
    if (filter.phaseId) {
      conditions.push(eq(tasks.phaseId, filter.phaseId));
    }
    if (filter.parentTaskId !== undefined) {
      if (filter.parentTaskId === null) {
        conditions.push(sql`${tasks.parentTaskId} IS NULL`);
      } else {
        conditions.push(eq(tasks.parentTaskId, filter.parentTaskId));
      }
    }
    if (filter.assignedTo) {
      conditions.push(eq(tasks.assignedTo, filter.assignedTo));
    }
    if (filter.isCritical !== undefined) {
      conditions.push(eq(tasks.isCritical, filter.isCritical));
    }
    if (filter.search) {
      conditions.push(like(tasks.name, `%${filter.search}%`));
    }

    const limit = Math.min(filter.limit ?? 50, 100);

    const totalResult = await this.db
      .select({ count: count() })
      .from(tasks)
      .where(and(...conditions));
    const totalCount = Number(totalResult[0]?.count ?? 0);

    if (filter.cursor) {
      conditions.push(sql`${tasks.id} > ${filter.cursor}`);
    }

    const items = await this.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.position), asc(tasks.id))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const last = items.pop()!;
      nextCursor = last.id;
    }

    return { items, nextCursor, totalCount };
  }

  async update(
    tx: any,
    orgId: string,
    projectId: string,
    taskId: string,
    patch: Partial<Task>,
    expectedVersion: number,
  ): Promise<Task> {
    const db = tx ?? this.db;

    const result = await db
      .update(tasks)
      .set({
        ...patch,
        version: sql`${tasks.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.projectId, projectId),
          eq(tasks.organizationId, orgId),
          eq(tasks.version, expectedVersion),
        ),
      )
      .returning();

    if (result.length === 0) {
      const existing = await this.findById(orgId, projectId, taskId);
      if (!existing) {
        throw new TaskNotFoundError();
      }
      throw new TaskModifiedError();
    }

    return result[0]!;
  }

  async delete(tx: any, orgId: string, projectId: string, taskId: string): Promise<void> {
    const db = tx ?? this.db;
    await db
      .delete(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.projectId, projectId),
          eq(tasks.organizationId, orgId),
        ),
      );
  }
}
