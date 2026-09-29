import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { PartnerPerformanceService } from './performance.service.js';

const svc = new PartnerPerformanceService();

export async function handleGetSupplierPerformance(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, supplierId } = req.params as any;
  const result = await svc.listSupplierEvents(organizationId, projectId, supplierId);
  return reply.send(createSuccessResponse(result));
}

export async function handleGetSubcontractorPerformance(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, subcontractorId } = req.params as any;
  const result = await svc.listSubcontractorEvents(organizationId, projectId, subcontractorId);
  return reply.send(createSuccessResponse(result));
}
