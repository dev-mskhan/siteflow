import type { FastifyReply, FastifyRequest } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import {
  materialRateResolveQuerySchema,
  materialRateVersionCreateSchema,
  materialRateVersionRetireSchema,
} from '@siteflow/shared';
import { projectPricingService } from './pricing.service.js';

type PricingParams = { projectId: string; rateId?: string };

function scope(request: FastifyRequest) {
  const params = request.params as PricingParams;
  return {
    scope: {
      organizationId: request.orgContext!.organizationId,
      projectId: params.projectId,
      actorUserId: request.user!.sub,
      requestId: request.id,
    },
    rateId: params.rateId,
  };
}

function requireRateId(rateId: string | undefined): string {
  if (!rateId) {
    throw new Error('rateId route parameter is missing');
  }
  return rateId;
}

export async function handleCreateRateVersion(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s } = scope(request);
  const input = materialRateVersionCreateSchema.parse(request.body);
  const rateVersion = await projectPricingService.createRateVersion(s, input);
  reply.status(201).send(createSuccessResponse({ rateVersion }));
}

export async function handleListRateVersions(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s } = scope(request);
  const { materialId } = request.query as { materialId: string };
  const rateVersions = await projectPricingService.listRateVersions(s, materialId);
  reply.send(createSuccessResponse({ rateVersions }));
}

export async function handleGetRateVersion(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, rateId } = scope(request);
  const rateVersion = await projectPricingService.getRateVersion(s, requireRateId(rateId));
  reply.send(createSuccessResponse({ rateVersion }));
}

export async function handleApproveRateVersion(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, rateId } = scope(request);
  const rateVersion = await projectPricingService.approveRateVersion(s, requireRateId(rateId));
  reply.send(createSuccessResponse({ rateVersion }));
}

export async function handleRetireRateVersion(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, rateId } = scope(request);
  const { effectiveTo } = materialRateVersionRetireSchema.parse(request.body);
  const rateVersion = await projectPricingService.retireRateVersion(s, requireRateId(rateId), effectiveTo);
  reply.send(createSuccessResponse({ rateVersion }));
}

export async function handleResolveRate(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s } = scope(request);
  const query = materialRateResolveQuerySchema.parse(request.query);
  const resolved = await projectPricingService.resolveRate(s, query);
  reply.send(createSuccessResponse({ resolved }));
}
