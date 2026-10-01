import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSuccessResponse } from '../../../shared/response.js';
import { PartnerPerformanceService } from './performance.service.js';

const svc = new PartnerPerformanceService();

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export async function handleGetSupplierPerformance(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, supplierId } = req.params as any;
  const query = listQuerySchema.parse(req.query);
  const result = await svc.listSupplierEvents(organizationId, projectId, supplierId, query);
  return reply.send(createSuccessResponse({ items: result.data, nextCursor: result.nextCursor }));
}

export async function handleGetSubcontractorPerformance(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, subcontractorId } = req.params as any;
  const query = listQuerySchema.parse(req.query);
  const result = await svc.listSubcontractorEvents(
    organizationId,
    projectId,
    subcontractorId,
    query,
  );
  return reply.send(createSuccessResponse({ items: result.data, nextCursor: result.nextCursor }));
}
