// apps/server/src/modules/ai/approvals/approval.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApprovalService } from './approval.service.js';
import { createSuccessResponse } from '../../../shared/response.js';

const approvalService = new ApprovalService();

const approvalParamsSchema = z.object({
  organizationId: z.string().uuid(),
  approvalId: z.string().uuid(),
});

const decisionBodySchema = z.object({
  note: z.string().max(500).optional(),
  reason: z.string().max(1000).optional(),
});

export async function handleGetApproval(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, approvalId } = approvalParamsSchema.parse(request.params);
  const approval = await approvalService.getApproval(approvalId, organizationId);
  if (!approval) {
    return reply.status(404).send({ error: 'Approval not found' });
  }
  return reply.send(createSuccessResponse({ approval }));
}

export async function handleApprove(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, approvalId } = approvalParamsSchema.parse(request.params);
  const body = decisionBodySchema.parse(request.body);
  const userId = request.user!.sub;

  await approvalService.approve(approvalId, organizationId, userId, body.note);
  return reply.send(createSuccessResponse({ message: 'Approval granted, run resumed' }));
}

export async function handleReject(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, approvalId } = approvalParamsSchema.parse(request.params);
  const body = decisionBodySchema.parse(request.body);
  const userId = request.user!.sub;

  await approvalService.reject(approvalId, organizationId, userId, body.reason ?? body.note);
  return reply.send(createSuccessResponse({ message: 'Approval rejected, run failed' }));
}
