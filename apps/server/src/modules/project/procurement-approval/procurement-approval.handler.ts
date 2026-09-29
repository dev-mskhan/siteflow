import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { ProcurementApprovalService } from './procurement-approval.service.js';
import {
  createApprovalSchema,
  reviewApprovalSchema,
  listApprovalsQuerySchema,
} from './procurement-approval.schemas.js';

const svc = new ProcurementApprovalService();

export async function handleListApprovals(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const query = listApprovalsQuerySchema.parse(req.query);
  const result = await svc.listApprovals(organizationId, projectId, query);
  reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleCreateApproval(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = createApprovalSchema.parse(req.body);
  const result = await svc.createApproval(actorUserId, organizationId, projectId, input);
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetApproval(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, approvalId } = req.params as any;
  const result = await svc.getApproval(organizationId, projectId, approvalId);
  reply.send(createSuccessResponse(result));
}

export async function handleApproveApproval(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, approvalId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = reviewApprovalSchema.parse(req.body ?? {});
  const result = await svc.approveApproval(actorUserId, organizationId, projectId, approvalId, input);
  reply.send(createSuccessResponse(result));
}

export async function handleRejectApproval(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, approvalId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = reviewApprovalSchema.parse(req.body ?? {});
  const result = await svc.rejectApproval(actorUserId, organizationId, projectId, approvalId, input);
  reply.send(createSuccessResponse(result));
}

export async function handleCancelApproval(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, approvalId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.cancelApproval(actorUserId, organizationId, projectId, approvalId);
  reply.send(createSuccessResponse(result));
}
