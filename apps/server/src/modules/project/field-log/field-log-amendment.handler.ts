// apps/server/src/modules/project/field-log/field-log-amendment.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { FieldLogAmendmentService } from './field-log-amendment.service.js';
import { createAmendmentSchema } from './field-log-amendment.schemas.js';

const amendmentService = new FieldLogAmendmentService();

export async function handleCreateAmendment(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, logId } = request.params as {
    organizationId: string;
    projectId: string;
    logId: string;
  };
  const actorUserId = request.user!.sub;
  const input = createAmendmentSchema.parse(request.body);

  const result = await amendmentService.createAmendment(
    actorUserId,
    organizationId,
    projectId,
    logId,
    input,
  );

  reply.status(201).send(createSuccessResponse(result));
}

export async function handleListAmendments(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, logId } = request.params as {
    organizationId: string;
    projectId: string;
    logId: string;
  };

  const result = await amendmentService.listAmendments(organizationId, projectId, logId);
  reply.send(createSuccessResponse(result));
}

export async function handleGetAmendment(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, amendmentId } = request.params as {
    organizationId: string;
    projectId: string;
    logId: string;
    amendmentId: string;
  };

  const result = await amendmentService.getAmendment(organizationId, projectId, amendmentId);
  reply.send(createSuccessResponse(result));
}
