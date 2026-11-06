// apps/server/src/modules/ai/okf/okf.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { OkfService } from './okf.service.js';

const okfService = new OkfService();

export async function handleListPages(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = req.params as { organizationId: string };
  const { status, pagePath } = req.query as { status?: string; pagePath?: string };

  const pages = await okfService.listPages(organizationId, { status, pagePath });

  return reply.send({ data: pages });
}

export async function handleGetPage(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, pageId } = req.params as { organizationId: string; pageId: string };

  const page = await okfService.getPage(pageId, organizationId);

  if (!page) {
    return reply.status(404).send({ error: 'OKF page not found' });
  }

  return reply.send({ data: page });
}

export async function handleApprovePage(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, pageId } = req.params as { organizationId: string; pageId: string };
  const { approvalNotes } = req.body as { approvalNotes?: string };
  const userId = req.user!.id;

  const page = await okfService.approvePage(pageId, organizationId, userId, approvalNotes);

  return reply.send({ data: page, message: 'OKF page approved' });
}

export async function handleRejectPage(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, pageId } = req.params as { organizationId: string; pageId: string };
  const { approvalNotes } = req.body as { approvalNotes?: string };
  const userId = req.user!.id;

  const page = await okfService.rejectPage(pageId, organizationId, userId, approvalNotes);

  return reply.send({ data: page, message: 'OKF page rejected' });
}

export async function handleDeletePage(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, pageId } = req.params as { organizationId: string; pageId: string };

  await okfService.deletePage(pageId, organizationId);

  return reply.send({ message: 'OKF page deleted' });
}
