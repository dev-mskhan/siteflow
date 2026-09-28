// apps/server/src/modules/project/task/task.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { TaskRepository } from './task.repository.js';
import { ProjectMemberRepository } from '../members/project-member.repository.js';
import { toTaskDTO, toTaskListDTO } from './task.mapper.js';
import {
  InvalidTaskTransitionError,
  InvalidTaskTypeOperationError,
  TaskDeletionForbiddenError,
  TaskConflictError,
} from './task.errors.js';
import type {
  TaskDTO,
  TaskListDTO,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatusTransitionInput,
  TaskFilter,
} from './task.types.js';
import type { Task, TaskStatus } from '@siteflow/database/schema';

const tracer = trace.getTracer('task-service');

const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  NOT_STARTED: ['READY', 'IN_PROGRESS', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'READY', 'CANCELLED'],
  COMPLETED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: ['NOT_STARTED'],
};

export class TaskService {
  constructor(
    private taskRepo = new TaskRepository(),
    private memberRepo = new ProjectMemberRepository(),
  ) {}

  private get db() {
    return getDb();
  }

  // ── Create Task ──────────────────────────────────────────────────────────────
  async createTask(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: CreateTaskInput,
    _correlationId?: string,
  ): Promise<TaskDTO> {
    return withSpan(tracer, 'task.createTask', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('actor.user_id', actorUserId);

      const taskType = input.taskType ?? 'TASK';

      // 1. Enforce Task Type Rules
      if (taskType === 'MILESTONE') {
        input.currentDurationDays = 0;
        if (input.currentStartDate && !input.currentFinishDate) {
          input.currentFinishDate = input.currentStartDate;
        } else if (input.currentFinishDate && !input.currentStartDate) {
          input.currentStartDate = input.currentFinishDate;
        }
      }

      // 2. Validate Parent Task (if specified)
      if (input.parentTaskId) {
        const parent = await this.taskRepo.findByIdOrThrow(orgId, projectId, input.parentTaskId);
        if (parent.taskType !== 'SUMMARY') {
          throw new InvalidTaskTypeOperationError('Parent task must be a SUMMARY task');
        }
      }

      // 3. Validate Assigned Member (if specified)
      if (input.assignedTo) {
        const member = await this.memberRepo.findActiveByProjectAndUser(
          orgId,
          projectId,
          input.assignedTo,
        );
        if (!member) {
          throw new InvalidTaskTypeOperationError('Assigned user is not an active project member');
        }
      }

      // 4. Auto-generate human taskCode if missing
      let taskCode = input.taskCode;
      if (!taskCode) {
        const totalCount = await this.taskRepo.countByProject(orgId, projectId);
        taskCode = `T-${(totalCount + 1).toString().padStart(3, '0')}`;
      } else {
        const existing = await this.taskRepo.findByCode(orgId, projectId, taskCode);
        if (existing) {
          throw new TaskConflictError(`Task code '${taskCode}' already exists in this project`);
        }
      }

      const nextPos = (await this.taskRepo.findMaxPosition(orgId, projectId)) + 1;
      const taskId = generateId();

      const created = await this.db.transaction(async (tx) => {
        const newTask = await this.taskRepo.create(tx, {
          id: taskId,
          organizationId: orgId,
          projectId,
          phaseId: input.phaseId ?? null,
          parentTaskId: input.parentTaskId ?? null,
          taskCode,
          name: input.name,
          description: input.description ?? null,
          taskType,
          status: 'NOT_STARTED',
          priority: input.priority ?? 'NORMAL',
          constraintType: input.constraintType ?? 'ASAP',
          constraintDate: input.constraintDate ?? null,
          assignedTo: input.assignedTo ?? null,
          subcontractorId: input.subcontractorId ?? null,
          currentStartDate: input.currentStartDate ?? null,
          currentFinishDate: input.currentFinishDate ?? null,
          currentDurationDays: input.currentDurationDays ?? (taskType === 'MILESTONE' ? 0 : 1),
          progressPercent: input.progressPercent ?? 0,
          position: nextPos,
          version: 1,
          createdBy: actorUserId,
        });

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'task.created',
            resourceType: 'Task',
            resourceId: taskId,
            metadata: {
              projectId,
              taskCode,
              taskType,
              name: input.name,
            },
          },
          tx,
        );

        return newTask;
      });

      // Recalculate summary parent if applicable
      if (input.parentTaskId) {
        await this.reevaluateSummaryTask(orgId, projectId, input.parentTaskId);
      }

      return toTaskDTO(created);
    });
  }

  // ── Get Task ─────────────────────────────────────────────────────────────────
  async getTask(orgId: string, projectId: string, taskId: string): Promise<TaskDTO> {
    return withSpan(tracer, 'task.getTask', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('task.id', taskId);

      const task = await this.taskRepo.findByIdOrThrow(orgId, projectId, taskId);
      return toTaskDTO(task);
    });
  }

  // ── List Tasks ───────────────────────────────────────────────────────────────
  async listTasks(
    orgId: string,
    projectId: string,
    filter: TaskFilter,
  ): Promise<TaskListDTO> {
    return withSpan(tracer, 'task.listTasks', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const result = await this.taskRepo.findAll(orgId, projectId, filter);
      return toTaskListDTO(result.items, result.nextCursor, result.totalCount);
    });
  }

  // ── Update Task ──────────────────────────────────────────────────────────────
  async updateTask(
    actorUserId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    input: UpdateTaskInput,
    _correlationId?: string,
  ): Promise<TaskDTO> {
    return withSpan(tracer, 'task.updateTask', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('task.id', taskId);

      const existing = await this.taskRepo.findByIdOrThrow(orgId, projectId, taskId);

      // Rule: Cannot manually set dates/duration on SUMMARY task
      if (existing.taskType === 'SUMMARY') {
        if (
          input.currentStartDate !== undefined ||
          input.currentFinishDate !== undefined ||
          input.currentDurationDays !== undefined ||
          input.progressPercent !== undefined
        ) {
          throw new InvalidTaskTypeOperationError(
            'Dates, duration, and progress of SUMMARY tasks are calculated from child tasks and cannot be set directly',
          );
        }
      }

      // Rule: MILESTONE duration must be 0
      if (existing.taskType === 'MILESTONE' && input.currentDurationDays !== undefined && input.currentDurationDays !== 0) {
        throw new InvalidTaskTypeOperationError('MILESTONE task duration must be 0');
      }

      // Validate Parent Task if changing
      if (input.parentTaskId !== undefined && input.parentTaskId !== existing.parentTaskId) {
        if (input.parentTaskId === taskId) {
          throw new InvalidTaskTypeOperationError('A task cannot be its own parent');
        }
        if (input.parentTaskId !== null) {
          const parent = await this.taskRepo.findByIdOrThrow(orgId, projectId, input.parentTaskId);
          if (parent.taskType !== 'SUMMARY') {
            throw new InvalidTaskTypeOperationError('Parent task must be a SUMMARY task');
          }
        }
      }

      // Validate Assigned Member if changing
      if (input.assignedTo) {
        const member = await this.memberRepo.findActiveByProjectAndUser(
          orgId,
          projectId,
          input.assignedTo,
        );
        if (!member) {
          throw new InvalidTaskTypeOperationError('Assigned user is not an active project member');
        }
      }

      const patch: Partial<Task> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.phaseId !== undefined) patch.phaseId = input.phaseId;
      if (input.parentTaskId !== undefined) patch.parentTaskId = input.parentTaskId;
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.constraintType !== undefined) patch.constraintType = input.constraintType;
      if (input.constraintDate !== undefined) patch.constraintDate = input.constraintDate;
      if (input.assignedTo !== undefined) patch.assignedTo = input.assignedTo;
      if (input.subcontractorId !== undefined) patch.subcontractorId = input.subcontractorId;
      if (input.currentStartDate !== undefined) patch.currentStartDate = input.currentStartDate;
      if (input.currentFinishDate !== undefined) patch.currentFinishDate = input.currentFinishDate;
      if (input.currentDurationDays !== undefined) patch.currentDurationDays = input.currentDurationDays;
      if (input.progressPercent !== undefined) patch.progressPercent = input.progressPercent;

      const updated = await this.db.transaction(async (tx) => {
        const res = await this.taskRepo.update(
          tx,
          orgId,
          projectId,
          taskId,
          patch,
          input.expectedVersion,
        );

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'task.updated',
            resourceType: 'Task',
            resourceId: taskId,
            metadata: {
              projectId,
              patch,
            },
          },
          tx,
        );

        return res;
      });

      // Re-evaluate summary tasks if hierarchy changed
      if (existing.parentTaskId && existing.parentTaskId !== input.parentTaskId) {
        await this.reevaluateSummaryTask(orgId, projectId, existing.parentTaskId);
      }
      if (input.parentTaskId) {
        await this.reevaluateSummaryTask(orgId, projectId, input.parentTaskId);
      }

      return toTaskDTO(updated);
    });
  }

  // ── Transition Task Status ───────────────────────────────────────────────────
  async transitionTaskStatus(
    actorUserId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    input: TaskStatusTransitionInput,
  ): Promise<TaskDTO> {
    return withSpan(tracer, 'task.transitionTaskStatus', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('task.id', taskId);

      const existing = await this.taskRepo.findByIdOrThrow(orgId, projectId, taskId);

      if (existing.taskType === 'SUMMARY') {
        throw new InvalidTaskTypeOperationError(
          'SUMMARY tasks status is derived from child tasks and cannot be directly transitioned',
        );
      }

      const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] ?? [];
      if (!allowedTransitions.includes(input.status)) {
        throw new InvalidTaskTransitionError(
          `Cannot transition task status from '${existing.status}' to '${input.status}'`,
        );
      }

      const patch: Partial<Task> = {
        status: input.status,
      };

      const today = new Date().toISOString().split('T')[0]!;
      if (input.status === 'IN_PROGRESS' && !existing.actualStartDate) {
        patch.actualStartDate = today;
      }
      if (input.status === 'COMPLETED') {
        if (!existing.actualFinishDate) {
          patch.actualFinishDate = today;
        }
        patch.progressPercent = 100;
      }

      const updated = await this.db.transaction(async (tx) => {
        const res = await this.taskRepo.update(
          tx,
          orgId,
          projectId,
          taskId,
          patch,
          input.expectedVersion,
        );

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'task.status_changed',
            resourceType: 'Task',
            resourceId: taskId,
            metadata: {
              projectId,
              fromStatus: existing.status,
              toStatus: input.status,
            },
          },
          tx,
        );

        return res;
      });

      if (existing.parentTaskId) {
        await this.reevaluateSummaryTask(orgId, projectId, existing.parentTaskId);
      }

      return toTaskDTO(updated);
    });
  }

  // ── Delete Task (Soft / Lifecycle) ───────────────────────────────────────────
  async deleteTask(
    actorUserId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    expectedVersion: number,
  ): Promise<void> {
    return withSpan(tracer, 'task.deleteTask', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('task.id', taskId);

      const existing = await this.taskRepo.findByIdOrThrow(orgId, projectId, taskId);

      const children = await this.taskRepo.findChildTasks(orgId, projectId, taskId);
      if (children.length > 0) {
        throw new TaskDeletionForbiddenError('Cannot delete a SUMMARY task that has child tasks');
      }

      // Soft delete by setting status = CANCELLED
      await this.db.transaction(async (tx) => {
        await this.taskRepo.update(
          tx,
          orgId,
          projectId,
          taskId,
          { status: 'CANCELLED' },
          expectedVersion,
        );

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'task.cancelled',
            resourceType: 'Task',
            resourceId: taskId,
            metadata: { projectId },
          },
          tx,
        );
      });

      if (existing.parentTaskId) {
        await this.reevaluateSummaryTask(orgId, projectId, existing.parentTaskId);
      }
    });
  }

  // ── Helper: Re-evaluate Parent SUMMARY Task ──────────────────────────────────
  private async reevaluateSummaryTask(
    orgId: string,
    projectId: string,
    summaryTaskId: string,
  ): Promise<void> {
    const children = await this.taskRepo.findChildTasks(orgId, projectId, summaryTaskId);
    const activeChildren = children.filter((c) => c.status !== 'CANCELLED');

    if (activeChildren.length === 0) return;

    let minStart: string | null = null;
    let maxFinish: string | null = null;
    let totalProgress = 0;

    let allCompleted = true;
    let anyInProgress = false;

    for (const child of activeChildren) {
      if (child.currentStartDate) {
        if (!minStart || child.currentStartDate < minStart) {
          minStart = child.currentStartDate;
        }
      }
      if (child.currentFinishDate) {
        if (!maxFinish || child.currentFinishDate > maxFinish) {
          maxFinish = child.currentFinishDate;
        }
      }
      totalProgress += child.progressPercent;

      if (child.status !== 'COMPLETED') {
        allCompleted = false;
      }
      if (child.status === 'IN_PROGRESS' || child.status === 'COMPLETED') {
        anyInProgress = true;
      }
    }

    const avgProgress = Math.round(totalProgress / activeChildren.length);
    let derivedStatus: TaskStatus = 'NOT_STARTED';
    if (allCompleted) {
      derivedStatus = 'COMPLETED';
    } else if (anyInProgress) {
      derivedStatus = 'IN_PROGRESS';
    }

    const summaryTask = await this.taskRepo.findById(orgId, projectId, summaryTaskId);
    if (!summaryTask) return;

    await this.db.transaction(async (tx) => {
      await this.taskRepo.update(
        tx,
        orgId,
        projectId,
        summaryTaskId,
        {
          currentStartDate: minStart,
          currentFinishDate: maxFinish,
          progressPercent: avgProgress,
          status: derivedStatus,
        },
        summaryTask.version,
      );
    });
  }
}
