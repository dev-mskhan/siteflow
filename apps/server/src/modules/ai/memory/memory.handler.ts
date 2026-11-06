// apps/server/src/modules/ai/memory/memory.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getMemoryStore } from './memory-store.js';

export async function handleListMemory(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = req.params as { organizationId: string };
  
  const store = getMemoryStore();
  const items = await store.getAll({ organizationId });
  
  return reply.send({ data: items });
}

export async function handleGetMemory(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, key } = req.params as { organizationId: string; key: string };
  
  const store = getMemoryStore();
  const value = await store.get({ organizationId }, key);
  
  if (value === null) {
    return reply.status(404).send({ error: 'Memory item not found' });
  }
  
  return reply.send({ data: { key, value } });
}

export async function handleSetMemory(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, key } = req.params as { organizationId: string; key: string };
  const { value } = req.body as { value: unknown };
  
  const store = getMemoryStore();
  await store.set({ organizationId }, key, value);
  
  return reply.send({ data: { key, value, message: 'Memory item saved' } });
}

export async function handleDeleteMemory(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, key } = req.params as { organizationId: string; key: string };
  
  const store = getMemoryStore();
  const deleted = await store.delete({ organizationId }, key);
  
  if (!deleted) {
    return reply.status(404).send({ error: 'Memory item not found' });
  }
  
  return reply.send({ data: { message: 'Memory item deleted' } });
}

export async function handleClearMemory(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = req.params as { organizationId: string };
  
  const store = getMemoryStore();
  const count = await store.deleteAll({ organizationId });
  
  return reply.send({ data: { deleted: count, message: `Cleared ${count} memory items` } });
}
