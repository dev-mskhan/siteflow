// apps/server/src/modules/project/dependency/dependency.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { DependencyService } from './dependency.service.js';
import { createDependencySchema } from './dependency.schemas.js';

const dependencyService = new DependencyService();

export async function handleCreateDependency(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = request.user!.sub;
  const input = createDependencySchema.parse(request.body);

  const result = await dependencyService.createDependency(
    actorUserId,
    organizationId,
    projectId,
    input,
  );

  reply.status(201).send(createSuccessResponse(result));
}

export async function handleDeleteDependency(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, dependencyId } = request.params as {
    organizationId: string;
    projectId: string;
    dependencyId: string;
  };
  const actorUserId = request.user!.sub;

  await dependencyService.deleteDependency(actorUserId, organizationId, projectId, dependencyId);

  reply.status(204).send();
}

export async function handleListDependencies(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const query = request.query as { taskId?: string };

  const result = await dependencyService.listDependencies(organizationId, {
    projectId,
    taskId: query.taskId,
  });

  reply.send(createSuccessResponse(result));
}
