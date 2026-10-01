// apps/server/src/modules/invitation/invitation.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { InvitationService } from './invitation.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import { createInvitationSchema } from './invitation.validation.js';

const invitationService = new InvitationService();

export async function handleCreateInvitation(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const body = createInvitationSchema.parse(request.body);

  const invitation = await invitationService.createInvitation(
    organizationId,
    request.orgContext!,
    body,
  );

  return reply.status(201).send(createSuccessResponse({ invitation }));
}

export async function handleListInvitations(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  });
  const query = querySchema.parse(request.query);
  const result = await invitationService.listInvitations(organizationId, query);
  return reply.send(createSuccessResponse({ data: result.data, nextCursor: result.nextCursor }));
}

export async function handleCancelInvitation(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, id } = request.params as { organizationId: string; id: string };

  await invitationService.cancelInvitation(organizationId, id, request.orgContext!);

  return reply.send(createSuccessResponse({ message: 'Invitation cancelled successfully' }));
}

export async function handleAcceptInvitation(request: FastifyRequest, reply: FastifyReply) {
  const { token } = request.params as { token: string };
  const userId = request.user!.sub;

  await invitationService.acceptInvitation(token, userId);

  return reply.send(createSuccessResponse({ message: 'Invitation accepted successfully' }));
}
