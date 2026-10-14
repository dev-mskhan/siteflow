import type { FastifyReply, FastifyRequest } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import {
  convertProposalSchema,
  createProposalSchema,
  createTenderSchema,
  issueProposalSchema,
  proposalListQuerySchema,
  proposalParamsSchema,
  proposalRevisionListQuerySchema,
  recordClientResponseSchema,
  rejectProposalSchema,
  tenderListQuerySchema,
  tenderParamsSchema,
  transitionProposalSchema,
  updateProposalSchema,
  updateTenderSchema,
  withdrawProposalSchema,
} from './proposal.schemas.js';
import { proposalService } from './proposal.service.js';

// ── Shared scope helper ───────────────────────────────────────────────────────
function scope(request: FastifyRequest) {
  const params = proposalParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    proposalId: params.proposalId,
    revisionId: params.revisionId,
    tenderId: params.tenderId,
  };
}

function tenderScope(request: FastifyRequest) {
  const params = tenderParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    tenderId: params.tenderId,
  };
}

// ── Tender handlers ───────────────────────────────────────────────────────────

export async function handleCreateTender(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId } = tenderScope(request);
  const input = createTenderSchema.parse(request.body);
  const tender = await proposalService.createTender(
    organizationId,
    input,
    request.user!.sub,
    request.id,
  );
  reply.status(201).send(createSuccessResponse({ tender }));
}

export async function handleListTenders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId } = tenderScope(request);
  const query = tenderListQuerySchema.parse(request.query);
  const result = await proposalService.listTenders(organizationId, query);
  reply.send(createSuccessResponse(result));
}

export async function handleGetTender(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, tenderId } = tenderScope(request);
  const tender = await proposalService.getTender(organizationId, tenderId!);
  reply.send(createSuccessResponse({ tender }));
}

export async function handleUpdateTender(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, tenderId } = tenderScope(request);
  const input = updateTenderSchema.parse(request.body);
  const tender = await proposalService.updateTender(
    organizationId,
    tenderId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ tender }));
}

export async function handleSubmitTender(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, tenderId } = tenderScope(request);
  const { expectedVersion } = transitionProposalSchema.parse(request.body);
  const tender = await proposalService.transitionTender(
    organizationId, tenderId!, 'SUBMITTED', expectedVersion,
    request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse({ tender }));
}

export async function handleAwardTender(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, tenderId } = tenderScope(request);
  const { expectedVersion } = transitionProposalSchema.parse(request.body);
  const tender = await proposalService.transitionTender(
    organizationId, tenderId!, 'AWARDED', expectedVersion,
    request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse({ tender }));
}

export async function handleLostTender(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, tenderId } = tenderScope(request);
  const { expectedVersion } = transitionProposalSchema.parse(request.body);
  const tender = await proposalService.transitionTender(
    organizationId, tenderId!, 'LOST', expectedVersion,
    request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse({ tender }));
}

export async function handleWithdrawTender(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, tenderId } = tenderScope(request);
  const { expectedVersion } = transitionProposalSchema.parse(request.body);
  const tender = await proposalService.transitionTender(
    organizationId, tenderId!, 'WITHDRAWN', expectedVersion,
    request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse({ tender }));
}

// ── Proposal handlers ─────────────────────────────────────────────────────────

export async function handleCreateProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId } = scope(request);
  const input = createProposalSchema.parse(request.body);
  const result = await proposalService.create(
    { organizationId, projectId },
    input,
    request.user!.sub,
    request.id,
  );
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleListProposals(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId } = scope(request);
  const query = proposalListQuerySchema.parse(request.query);
  const result = await proposalService.list({ organizationId, projectId }, query);
  reply.send(createSuccessResponse(result));
}

export async function handleGetProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const result = await proposalService.getById({ organizationId, projectId }, proposalId!);
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const input = updateProposalSchema.parse(request.body);
  const result = await proposalService.update(
    { organizationId, projectId },
    proposalId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleSubmitProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const input = transitionProposalSchema.parse(request.body);
  const result = await proposalService.submit(
    { organizationId, projectId }, proposalId!, input, request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleApproveProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const input = transitionProposalSchema.parse(request.body);
  const result = await proposalService.approve(
    { organizationId, projectId }, proposalId!, input, request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleRejectProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const input = rejectProposalSchema.parse(request.body);
  const result = await proposalService.reject(
    { organizationId, projectId }, proposalId!, input, request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleIssueProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const input = issueProposalSchema.parse(request.body);
  const result = await proposalService.issue(
    { organizationId, projectId }, proposalId!, input, request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleRecordClientResponse(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const input = recordClientResponseSchema.parse(request.body);
  const result = await proposalService.recordClientResponse(
    { organizationId, projectId }, proposalId!, input, request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleWithdrawProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const input = withdrawProposalSchema.parse(request.body);
  const result = await proposalService.withdraw(
    { organizationId, projectId }, proposalId!, input, request.user!.sub, request.id,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleListProposalRevisions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const query = proposalRevisionListQuerySchema.parse(request.query);
  const result = await proposalService.listRevisions(
    { organizationId, projectId }, proposalId!, query,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleGetProposalRevision(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId, revisionId } = scope(request);
  const result = await proposalService.getRevision(
    { organizationId, projectId }, proposalId!, revisionId!,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleListClientEvents(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const events = await proposalService.listClientEvents({ organizationId, projectId }, proposalId!);
  reply.send(createSuccessResponse({ events }));
}

export async function handleConvertProposal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, proposalId } = scope(request);
  const input = convertProposalSchema.parse(request.body);
  const result = await proposalService.convert(
    { organizationId, projectId }, proposalId!, input, request.user!.sub, request.id,
  );
  reply.status(result.alreadyConverted ? 200 : 202).send(createSuccessResponse(result));
}
