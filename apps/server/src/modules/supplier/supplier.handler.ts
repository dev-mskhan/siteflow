import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../shared/response.js';
import { SupplierService } from './supplier.service.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  createSupplierContactSchema,
  updateSupplierContactSchema,
  listSuppliersQuerySchema,
} from './supplier.schemas.js';

const supplierService = new SupplierService();

export async function handleListSuppliers(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = req.params as { organizationId: string };
  const query = listSuppliersQuerySchema.parse(req.query);
  const result = await supplierService.listSuppliers(organizationId, query);
  return reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleCreateSupplier(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = req.params as { organizationId: string };
  const actorUserId = (req as any).user!.sub;
  const input = createSupplierSchema.parse(req.body);
  const result = await supplierService.createSupplier(actorUserId, organizationId, input);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetSupplier(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, supplierId } = req.params as { organizationId: string; supplierId: string };
  const result = await supplierService.getSupplier(organizationId, supplierId);
  return reply.send(createSuccessResponse(result));
}

export async function handleUpdateSupplier(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, supplierId } = req.params as { organizationId: string; supplierId: string };
  const actorUserId = (req as any).user!.sub;
  const input = updateSupplierSchema.parse(req.body);
  const result = await supplierService.updateSupplier(actorUserId, organizationId, supplierId, input);
  return reply.send(createSuccessResponse(result));
}

export async function handleCreateSupplierContact(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, supplierId } = req.params as { organizationId: string; supplierId: string };
  const actorUserId = (req as any).user!.sub;
  const input = createSupplierContactSchema.parse(req.body);
  const result = await supplierService.createContact(actorUserId, organizationId, supplierId, input);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function handleUpdateSupplierContact(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, supplierId, contactId } = req.params as {
    organizationId: string;
    supplierId: string;
    contactId: string;
  };
  const actorUserId = (req as any).user!.sub;
  const input = updateSupplierContactSchema.parse(req.body);
  const result = await supplierService.updateContact(actorUserId, organizationId, supplierId, contactId, input);
  return reply.send(createSuccessResponse(result));
}
