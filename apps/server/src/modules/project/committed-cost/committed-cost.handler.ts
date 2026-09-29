import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { CommittedCostService } from './committed-cost.service.js';
import { z } from 'zod';

const svc = new CommittedCostService();

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['ACTIVE', 'RELEASED', 'CANCELLED']).optional(),
});

export async function handleListCommittedCosts(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const query = listQuerySchema.parse(req.query);
  const result = await svc.listCommittedCosts(organizationId, projectId, query);
  reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleGetCommittedCost(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, committedCostId } = req.params as any;
  const result = await svc.getCommittedCost(organizationId, projectId, committedCostId);
  reply.send(createSuccessResponse(result));
}
