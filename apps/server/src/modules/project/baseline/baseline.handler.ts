// apps/server/src/modules/project/baseline/baseline.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { BaselineService } from './baseline.service.js';
import { createBaselineSchema } from './baseline.schemas.js';

const baselineService = new BaselineService();

export async function handleCreateBaseline(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = request.user!.sub;
  const input = createBaselineSchema.parse(request.body);

  const result = await baselineService.createBaseline(
    actorUserId,
    organizationId,
    projectId,
    input,
  );

  reply.status(201).send(createSuccessResponse(result));
}

export async function handleActivateBaseline(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, baselineId } = request.params as {
    organizationId: string;
    projectId: string;
    baselineId: string;
  };
  const actorUserId = request.user!.sub;

  const result = await baselineService.activateBaseline(
    actorUserId,
    organizationId,
    projectId,
    baselineId,
  );

  reply.send(createSuccessResponse(result));
}

export async function handleGetBaseline(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, baselineId } = request.params as {
    organizationId: string;
    projectId: string;
    baselineId: string;
  };

  const result = await baselineService.getBaseline(organizationId, projectId, baselineId);
  reply.send(createSuccessResponse(result));
}

export async function handleListBaselines(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };

  const result = await baselineService.listBaselines(organizationId, projectId);
  reply.send(createSuccessResponse(result));
}

export async function handleCompareBaseline(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, baselineId } = request.params as {
    organizationId: string;
    projectId: string;
    baselineId: string;
  };

  const result = await baselineService.compareBaselineWithCurrent(
    organizationId,
    projectId,
    baselineId,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleDeleteBaseline(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, baselineId } = request.params as {
    organizationId: string;
    projectId: string;
    baselineId: string;
  };
  const actorUserId = request.user!.sub;

  await baselineService.deleteBaseline(actorUserId, organizationId, projectId, baselineId);
  reply.status(204).send();
}
