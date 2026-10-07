import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  approvePaymentApplicationSchema,
  createPaymentApplicationSchema,
  listPaymentApplicationsQuerySchema,
  paymentApplicationParamsSchema,
  paymentApplicationTransitionSchema,
  rejectPaymentApplicationSchema,
  updatePaymentApplicationSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { paymentApplicationService } from './payment-application.service.js';

function scope(request: FastifyRequest) {
  const params = paymentApplicationParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    paymentApplicationId: params.paymentApplicationId,
  };
}

export async function handleCreatePaymentApplication(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = scope(request);
  const paymentApplication = await paymentApplicationService.create(
    request.user!.sub,
    organizationId,
    projectId,
    createPaymentApplicationSchema.parse(request.body),
    request.id,
  );
  return reply.status(201).send(createSuccessResponse({ paymentApplication }));
}

export async function handleListPaymentApplications(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = scope(request);
  const query = listPaymentApplicationsQuerySchema.parse(request.query);
  const result = await paymentApplicationService.list(organizationId, projectId, query);
  return reply.send(createSuccessResponse(result));
}

export async function handleGetPaymentApplication(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, paymentApplicationId } = scope(request);
  const paymentApplication = await paymentApplicationService.get(
    organizationId,
    projectId,
    paymentApplicationId!,
  );
  return reply.send(createSuccessResponse({ paymentApplication }));
}

export async function handleUpdatePaymentApplication(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, paymentApplicationId } = scope(request);
  const paymentApplication = await paymentApplicationService.updateDraft(
    request.user!.sub,
    organizationId,
    projectId,
    paymentApplicationId!,
    updatePaymentApplicationSchema.parse(request.body),
    request.id,
  );
  return reply.send(createSuccessResponse({ paymentApplication }));
}

async function transition(
  request: FastifyRequest,
  operation: 'submit' | 'under-review' | 'approve' | 'reject' | 'void',
) {
  const { organizationId, projectId, paymentApplicationId } = scope(request);
  const actor = request.user!.sub;
  const service = paymentApplicationService;
  if (operation === 'approve') {
    return service.approve(
      actor,
      organizationId,
      projectId,
      paymentApplicationId!,
      approvePaymentApplicationSchema.parse(request.body),
      request.id,
    );
  }
  if (operation === 'reject') {
    const input = rejectPaymentApplicationSchema.parse(request.body);
    return service.reject(
      actor,
      organizationId,
      projectId,
      paymentApplicationId!,
      input.expectedVersion,
      input.reason,
      request.id,
    );
  }
  const { expectedVersion } = paymentApplicationTransitionSchema.parse(request.body);
  if (operation === 'submit') {
    return service.submit(
      actor,
      organizationId,
      projectId,
      paymentApplicationId!,
      expectedVersion,
      request.id,
    );
  }
  if (operation === 'under-review') {
    return service.underReview(
      actor,
      organizationId,
      projectId,
      paymentApplicationId!,
      expectedVersion,
      request.id,
    );
  }
  return service.void(
    actor,
    organizationId,
    projectId,
    paymentApplicationId!,
    expectedVersion,
    request.id,
  );
}

async function sendTransition(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: 'submit' | 'under-review' | 'approve' | 'reject' | 'void',
) {
  const paymentApplication = await transition(request, operation);
  return reply.send(createSuccessResponse({ paymentApplication }));
}

export const handleSubmitPaymentApplication = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'submit');
export const handleUnderReviewPaymentApplication = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'under-review');
export const handleApprovePaymentApplication = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'approve');
export const handleRejectPaymentApplication = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'reject');
export const handleVoidPaymentApplication = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'void');
