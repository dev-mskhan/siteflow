// apps/server/src/modules/project/field-log/field-log.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { FieldLogService } from './field-log.service.js';
import { createFieldLogSchema, updateFieldLogSchema } from './field-log.schemas.js';

const fieldLogService = new FieldLogService();

export async function handleCreateFieldLog(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = request.user!.sub;
  const input = createFieldLogSchema.parse(request.body);

  const result = await fieldLogService.createFieldLog(actorUserId, organizationId, projectId, input);
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetFieldLog(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, logId } = request.params as {
    organizationId: string;
    projectId: string;
    logId: string;
  };

  const result = await fieldLogService.getFieldLog(organizationId, projectId, logId);
  reply.send(createSuccessResponse(result));
}

export async function handleListFieldLogs(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };

  const result = await fieldLogService.listFieldLogs(organizationId, projectId);
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateFieldLog(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, logId } = request.params as {
    organizationId: string;
    projectId: string;
    logId: string;
  };
  const actorUserId = request.user!.sub;
  const input = updateFieldLogSchema.parse(request.body);

  const result = await fieldLogService.updateFieldLog(
    actorUserId,
    organizationId,
    projectId,
    logId,
    input,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleSubmitFieldLog(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, logId } = request.params as {
    organizationId: string;
    projectId: string;
    logId: string;
  };
  const actorUserId = request.user!.sub;

  const result = await fieldLogService.submitFieldLog(actorUserId, organizationId, projectId, logId);
  reply.send(createSuccessResponse(result));
}

export async function handleLockFieldLog(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, logId } = request.params as {
    organizationId: string;
    projectId: string;
    logId: string;
  };
  const actorUserId = request.user!.sub;

  const result = await fieldLogService.lockFieldLog(actorUserId, organizationId, projectId, logId);
  reply.send(createSuccessResponse(result));
}
