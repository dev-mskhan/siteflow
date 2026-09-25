// apps/server/src/modules/organization/sequences/sequences.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { DocumentSequenceService } from './sequences.service.js';
import { updateSequenceSchema } from './sequences.validation.js';
import { createSuccessResponse } from '../../../shared/response.js';
import type { DocumentSequenceType } from './sequences.types.js';
import { NotFoundError } from '../organization.errors.js';

const sequenceService = new DocumentSequenceService();

const VALID_SEQUENCE_TYPES: Set<string> = new Set([
  'PROJECT',
  'ESTIMATE',
  'INVOICE',
  'PURCHASE_ORDER',
  'CHANGE_ORDER',
  'RFI',
  'SUBMITTAL',
]);

function assertValidSequenceType(type: string): asserts type is DocumentSequenceType {
  if (!VALID_SEQUENCE_TYPES.has(type)) {
    throw new NotFoundError(`Document sequence type '${type}' not found`);
  }
}

export async function handleListSequences(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const sequences = await sequenceService.listSequences(organizationId);
  return reply.send(createSuccessResponse({ sequences }));
}

export async function handleGetSequence(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, type } = request.params as { organizationId: string; type: string };
  assertValidSequenceType(type);
  const sequence = await sequenceService.getSequence(organizationId, type);
  return reply.send(createSuccessResponse({ sequence }));
}

export async function handleUpdateSequence(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, type } = request.params as { organizationId: string; type: string };
  assertValidSequenceType(type);
  const body = updateSequenceSchema.parse(request.body);
  const sequence = await sequenceService.updateSequence(
    organizationId,
    type,
    request.orgContext!,
    body,
  );
  return reply.send(createSuccessResponse({ sequence }));
}
