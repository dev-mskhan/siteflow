import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { MaterialRequestService } from './material-request.service.js';
import {
  createMaterialRequestSchema,
  updateMaterialRequestSchema,
  listMaterialRequestsQuerySchema,
} from './material-request.schemas.js';

const svc = new MaterialRequestService();

export async function handleListMaterialRequests(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const query = listMaterialRequestsQuerySchema.parse(req.query);
  const result = await svc.listMaterialRequests(organizationId, projectId, query);
  reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleCreateMaterialRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = createMaterialRequestSchema.parse(req.body);
  const result = await svc.createMaterialRequest(actorUserId, organizationId, projectId, null, input);
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetMaterialRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, requestId } = req.params as any;
  const result = await svc.getMaterialRequest(organizationId, projectId, requestId);
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateMaterialRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, requestId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = updateMaterialRequestSchema.parse(req.body);
  const result = await svc.updateMaterialRequest(actorUserId, organizationId, projectId, requestId, input);
  reply.send(createSuccessResponse(result));
}

export async function handleSubmitMaterialRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, requestId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.submitMaterialRequest(actorUserId, organizationId, projectId, requestId);
  reply.send(createSuccessResponse(result));
}

export async function handleCancelMaterialRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, requestId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.cancelMaterialRequest(actorUserId, organizationId, projectId, requestId);
  reply.send(createSuccessResponse(result));
}
