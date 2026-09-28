// apps/server/src/modules/project/task/task.mapper.ts
import type { Task } from '@siteflow/database/schema';
import type { TaskDTO, TaskListDTO } from './task.types.js';

export function toTaskDTO(task: Task): TaskDTO {
  return {
    id: task.id,
    organizationId: task.organizationId,
    projectId: task.projectId,
    phaseId: task.phaseId,
    parentTaskId: task.parentTaskId,
    taskCode: task.taskCode,
    externalReference: task.externalReference,
    name: task.name,
    description: task.description,
    taskType: task.taskType,
    status: task.status,
    priority: task.priority,
    constraintType: task.constraintType,
    constraintDate: task.constraintDate,
    assignedTo: task.assignedTo,
    subcontractorId: task.subcontractorId,
    currentStartDate: task.currentStartDate,
    currentFinishDate: task.currentFinishDate,
    currentDurationDays: task.currentDurationDays,
    actualStartDate: task.actualStartDate,
    actualFinishDate: task.actualFinishDate,
    floatDays: task.floatDays,
    isCritical: task.isCritical,
    progressPercent: task.progressPercent,
    position: task.position,
    version: task.version,
    createdBy: task.createdBy,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function toTaskListDTO(
  items: Task[],
  nextCursor: string | null,
  totalCount: number,
): TaskListDTO {
  return {
    items: items.map(toTaskDTO),
    nextCursor,
    totalCount,
  };
}
