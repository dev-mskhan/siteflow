import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../shared/response.js';
import { MaterialService } from './material.service.js';
import {
  createMaterialSchema,
  updateMaterialSchema,
  listMaterialsQuerySchema,
} from './material.schemas.js';

const materialService = new MaterialService();

export async function handleListMaterials(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = req.params as { organizationId: string };
  const query = listMaterialsQuerySchema.parse(req.query);
  const result = await materialService.listMaterials(organizationId, query);
  return reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleCreateMaterial(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = req.params as { organizationId: string };
  const actorUserId = (req as any).user!.sub;
  const input = createMaterialSchema.parse(req.body);
  const result = await materialService.createMaterial(actorUserId, organizationId, input);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetMaterial(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, materialId } = req.params as { organizationId: string; materialId: string };
  const result = await materialService.getMaterial(organizationId, materialId);
  return reply.send(createSuccessResponse(result));
}

export async function handleUpdateMaterial(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, materialId } = req.params as { organizationId: string; materialId: string };
  const actorUserId = (req as any).user!.sub;
  const input = updateMaterialSchema.parse(req.body);
  const result = await materialService.updateMaterial(actorUserId, organizationId, materialId, input);
  return reply.send(createSuccessResponse(result));
}
