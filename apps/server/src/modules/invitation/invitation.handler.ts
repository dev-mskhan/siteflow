// apps/server/src/modules/invitation/invitation.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { InvitationService } from './invitation.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import { createInvitationSchema, acceptInvitationSchema } from './invitation.validation.js';

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
  const invitations = await invitationService.listInvitations(organizationId);

  return reply.send(createSuccessResponse({ invitations }));
}

export async function handleCancelInvitation(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, id } = request.params as { organizationId: string; id: string };

  await invitationService.cancelInvitation(organizationId, id, request.orgContext!);

  return reply.send(createSuccessResponse({ message: 'Invitation cancelled successfully' }));
}

export async function handleAcceptInvitation(request: FastifyRequest, reply: FastifyReply) {
  const { token } = acceptInvitationSchema.parse(request.body);
  const userId = request.user!.sub;

  await invitationService.acceptInvitation(token, userId);

  return reply.send(createSuccessResponse({ message: 'Invitation accepted successfully' }));
}
