// apps/server/src/modules/project/dependency/dependency.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { DependencyRepository } from './dependency.repository.js';
import {
  DependencyNotFoundError,
  DependencyAlreadyExistsError,
  DependencyCycleError,
  DependencySelfReferenceError,
  DependencyTaskNotInProjectError,
} from './dependency.errors.js';
import type {
  DependencyDTO,
  CreateDependencyInput,
  ListDependenciesInput,
} from './dependency.types.js';
import type { TaskDependency } from '@siteflow/database/schema';

const tracer = trace.getTracer('dependency-service');

function toDependencyDTO(row: TaskDependency): DependencyDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    taskId: row.taskId,
    predecessorId: row.predecessorId,
    dependencyType: row.dependencyType as DependencyDTO['dependencyType'],
    lagDays: row.lagDays,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DependencyService {
  constructor(private depRepo = new DependencyRepository()) {}

  private get db() {
    return getDb();
  }

  // ── Create Dependency ────────────────────────────────────────────────────────
  // Uses project-scoped schedule lock (SELECT ... FOR UPDATE) to prevent
  // concurrent graph mutations creating cycles that evade detection.
  async createDependency(
    _actorUserId: string,
    orgId: string,
    projectId: string,
    input: CreateDependencyInput,
  ): Promise<DependencyDTO> {
    return withSpan(tracer, 'dependency.create', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('task.id', input.taskId);
      span.setAttribute('predecessor.id', input.predecessorId);


      // Self-reference guard (also enforced by DB CHECK, but fail fast here)
      if (input.taskId === input.predecessorId) {
        throw new DependencySelfReferenceError(input.taskId);
      }

      const created = await this.db.transaction(async (tx) => {
        // ── STEP 1: Acquire project-scoped schedule lock ─────────────────────
        // This prevents two concurrent transactions from both passing cycle
        // detection (which reads uncommitted rows of the OTHER transaction)
        // and then both inserting a cycle-forming edge.
        await tx.execute(sql`
          SELECT id FROM app.projects
          WHERE id = ${projectId}
            AND organization_id = ${orgId}
          FOR UPDATE
        `);

        // ── STEP 2: Verify both tasks belong to this project ─────────────────
        const { taskExists, predecessorExists } = await this.depRepo.verifyTasksInProject(
          tx as any,
          projectId,
          orgId,
          input.taskId,
          input.predecessorId,
        );

        if (!taskExists) {
          throw new DependencyTaskNotInProjectError(input.taskId, projectId);
        }
        if (!predecessorExists) {
          throw new DependencyTaskNotInProjectError(input.predecessorId, projectId);
        }

        // ── STEP 3: Duplicate check ──────────────────────────────────────────
        const existing = await this.depRepo.findByTaskAndPredecessor(
          tx as any,
          input.taskId,
          input.predecessorId,
        );
        if (existing) {
          throw new DependencyAlreadyExistsError(input.taskId, input.predecessorId);
        }

        // ── STEP 4: Cycle detection ──────────────────────────────────────────
        // Check if taskId is reachable from predecessorId following the
        // existing successor graph. If yes, adding this edge would create a cycle.
        const hasCycle = await this.depRepo.wouldCreateCycle(
          tx as any,
          projectId,
          input.taskId,
          input.predecessorId,
        );
        if (hasCycle) {
          throw new DependencyCycleError(input.taskId, input.predecessorId);
        }

        // ── STEP 5: Insert ───────────────────────────────────────────────────
        const dep = await this.depRepo.insert(tx as any, {
          id: generateId(),
          organizationId: orgId,
          projectId,
          taskId: input.taskId,
          predecessorId: input.predecessorId,
          dependencyType: input.dependencyType ?? 'FS',
          lagDays: input.lagDays ?? 0,
          createdAt: new Date(),
        });

        return dep;
      });

      return toDependencyDTO(created);
    });
  }

  // ── Delete Dependency ────────────────────────────────────────────────────────
  async deleteDependency(
    _actorUserId: string,
    orgId: string,
    projectId: string,
    dependencyId: string,
  ): Promise<void> {
    return withSpan(tracer, 'dependency.delete', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('dependency.id', dependencyId);

      // Verify exists first (for proper 404 vs 403 semantics)
      const dep = await this.depRepo.findById(this.db as any, dependencyId, orgId);
      if (!dep || dep.projectId !== projectId) {
        throw new DependencyNotFoundError(dependencyId);
      }

      await this.depRepo.delete(this.db as any, dependencyId, orgId);
    });
  }

  // ── List Dependencies for Project ─────────────────────────────────────────────
  async listDependencies(
    orgId: string,
    input: ListDependenciesInput,
  ): Promise<DependencyDTO[]> {
    return withSpan(tracer, 'dependency.list', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', input.projectId);

      if (input.taskId) {
        const rows = await this.depRepo.findByTask(this.db as any, input.taskId, orgId);
        return rows
          .filter((r) => r.projectId === input.projectId)
          .map(toDependencyDTO);
      }

      const rows = await this.depRepo.findByProject(this.db as any, input.projectId, orgId);
      return rows.map(toDependencyDTO);
    });
  }
}
