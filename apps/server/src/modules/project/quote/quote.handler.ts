import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { QuoteService } from './quote.service.js';
import { createQuoteSchema, updateQuoteSchema, listQuotesQuerySchema } from './quote.schemas.js';

const svc = new QuoteService();

export async function handleListQuotes(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const query = listQuotesQuerySchema.parse(req.query);
  const result = await svc.listQuotes(organizationId, projectId, query);
  reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleCreateQuote(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = createQuoteSchema.parse(req.body);
  const result = await svc.createQuote(actorUserId, organizationId, projectId, input);
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetQuote(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, quoteId } = req.params as any;
  const result = await svc.getQuote(organizationId, projectId, quoteId);
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateQuote(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, quoteId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = updateQuoteSchema.parse(req.body);
  const result = await svc.updateQuote(actorUserId, organizationId, projectId, quoteId, input);
  reply.send(createSuccessResponse(result));
}

export async function handleSubmitQuote(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, quoteId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.submitQuote(actorUserId, organizationId, projectId, quoteId);
  reply.send(createSuccessResponse(result));
}

export async function handleAcceptQuote(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, quoteId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.acceptQuote(actorUserId, organizationId, projectId, quoteId);
  reply.send(createSuccessResponse(result));
}

export async function handleRejectQuote(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, quoteId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.rejectQuote(actorUserId, organizationId, projectId, quoteId);
  reply.send(createSuccessResponse(result));
}
