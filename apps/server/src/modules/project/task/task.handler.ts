// apps/server/src/modules/project/task/task.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { TaskService } from './task.service.js';
import {
  createTaskSchema,
  updateTaskSchema,
  transitionTaskStatusSchema,
  listTasksQuerySchema,
} from './task.schemas.js';

const taskService = new TaskService();

export async function handleCreateTask(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = request.user!.sub;
  const input = createTaskSchema.parse(request.body);

  const result = await taskService.createTask(
    actorUserId,
    organizationId,
    projectId,
    input,
    request.id,
  );

  reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetTask(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, taskId } = request.params as {
    organizationId: string;
    projectId: string;
    taskId: string;
  };
  const result = await taskService.getTask(organizationId, projectId, taskId);
  reply.send(createSuccessResponse(result));
}

export async function handleListTasks(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const query = listTasksQuerySchema.parse(request.query);
  const result = await taskService.listTasks(organizationId, projectId, query);
  reply.send(createSuccessResponse(result.items, { nextCursor: result.nextCursor, totalCount: result.totalCount }));
}

export async function handleUpdateTask(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, taskId } = request.params as {
    organizationId: string;
    projectId: string;
    taskId: string;
  };
  const actorUserId = request.user!.sub;
  const input = updateTaskSchema.parse(request.body);

  const result = await taskService.updateTask(
    actorUserId,
    organizationId,
    projectId,
    taskId,
    input,
    request.id,
  );

  reply.send(createSuccessResponse(result));
}

export async function handleTransitionTaskStatus(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, taskId } = request.params as {
    organizationId: string;
    projectId: string;
    taskId: string;
  };
  const actorUserId = request.user!.sub;
  const input = transitionTaskStatusSchema.parse(request.body);

  const result = await taskService.transitionTaskStatus(
    actorUserId,
    organizationId,
    projectId,
    taskId,
    input,
  );

  reply.send(createSuccessResponse(result));
}

export async function handleDeleteTask(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, taskId } = request.params as {
    organizationId: string;
    projectId: string;
    taskId: string;
  };
  const actorUserId = request.user!.sub;
  const body = request.body as { expectedVersion?: number } | undefined;
  const expectedVersion = Number(body?.expectedVersion ?? 1);

  await taskService.deleteTask(
    actorUserId,
    organizationId,
    projectId,
    taskId,
    expectedVersion,
  );

  reply.send(createSuccessResponse({ message: 'Task cancelled successfully' }));
}
