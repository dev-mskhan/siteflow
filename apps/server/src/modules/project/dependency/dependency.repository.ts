// apps/server/src/modules/project/dependency/dependency.repository.ts
import { eq, and, or } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { taskDependencies, tasks } from '@siteflow/database/schema';
import type { TaskDependency, NewTaskDependency } from '@siteflow/database/schema';

export class DependencyRepository {
  // ── Insert ────────────────────────────────────────────────────────────────
  async insert(
    db: PostgresJsDatabase,
    data: NewTaskDependency,
  ): Promise<TaskDependency> {
    const [row] = await db.insert(taskDependencies).values(data).returning();
    return row!;
  }

  // ── Find by id (with org guard) ───────────────────────────────────────────
  async findById(
    db: PostgresJsDatabase,
    dependencyId: string,
    organizationId: string,
  ): Promise<TaskDependency | null> {
    const [row] = await db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.id, dependencyId),
          eq(taskDependencies.organizationId, organizationId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // ── Find existing link (unique check) ─────────────────────────────────────
  async findByTaskAndPredecessor(
    db: PostgresJsDatabase,
    taskId: string,
    predecessorId: string,
  ): Promise<TaskDependency | null> {
    const [row] = await db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.predecessorId, predecessorId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // ── List all dependencies for a project ───────────────────────────────────
  async findByProject(
    db: PostgresJsDatabase,
    projectId: string,
    organizationId: string,
  ): Promise<TaskDependency[]> {
    return db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.projectId, projectId),
          eq(taskDependencies.organizationId, organizationId),
        ),
      );
  }

  // ── List dependencies for a specific task (as successor) ─────────────────
  async findByTask(
    db: PostgresJsDatabase,
    taskId: string,
    organizationId: string,
  ): Promise<TaskDependency[]> {
    return db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.organizationId, organizationId),
        ),
      );
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete(
    db: PostgresJsDatabase,
    dependencyId: string,
    organizationId: string,
  ): Promise<boolean> {
    const result = await db
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.id, dependencyId),
          eq(taskDependencies.organizationId, organizationId),
        ),
      )
      .returning({ id: taskDependencies.id });
    return result.length > 0;
  }


  // ── Verify both tasks belong to project ───────────────────────────────────
  async verifyTasksInProject(
    db: PostgresJsDatabase,
    projectId: string,
    organizationId: string,
    taskId: string,
    predecessorId: string,
  ): Promise<{ taskExists: boolean; predecessorExists: boolean }> {
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          eq(tasks.organizationId, organizationId),
          or(eq(tasks.id, taskId), eq(tasks.id, predecessorId)),
        ),
      );

    const ids = new Set(rows.map((r) => r.id));
    return {
      taskExists: ids.has(taskId),
      predecessorExists: ids.has(predecessorId),
    };
  }

  // ── Cycle detection via iterative ancestor traversal ──────────────────────
  // Returns true if adding the edge (predecessorId → taskId) would create a cycle.
  //
  // A cycle exists when taskId is already an ancestor of predecessorId.
  // We traverse the predecessor chain of predecessorId iteratively until
  // we find taskId (cycle!) or exhaust all ancestors (no cycle).
  async wouldCreateCycle(
    db: PostgresJsDatabase,
    projectId: string,
    taskId: string,
    predecessorId: string,
  ): Promise<boolean> {
    // Fetch all dependency rows for this project in one query (efficient for small-medium graphs)
    const allDeps = await db
      .select({ taskId: taskDependencies.taskId, predecessorId: taskDependencies.predecessorId })
      .from(taskDependencies)
      .where(eq(taskDependencies.projectId, projectId));

    // Build a map: task → set of its direct predecessors
    const predMap = new Map<string, Set<string>>();
    for (const dep of allDeps) {
      if (!predMap.has(dep.taskId)) predMap.set(dep.taskId, new Set());
      predMap.get(dep.taskId)!.add(dep.predecessorId);
    }

    // BFS/DFS from predecessorId going backwards through predecessor chain
    const visited = new Set<string>();
    const queue: string[] = [predecessorId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === taskId) return true; // Found taskId as an ancestor → cycle!
      if (visited.has(current)) continue;
      visited.add(current);
      const preds = predMap.get(current);
      if (preds) {
        for (const p of preds) {
          if (!visited.has(p)) queue.push(p);
        }
      }
    }

    return false;
  }
}


