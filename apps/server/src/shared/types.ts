// apps/server/src/shared/types.ts
// Server-internal shared type definitions.

import type { FastifyRequest, FastifyReply } from 'fastify';

/** Common handler context passed to module service functions. */
export interface ApiContext {
  request: FastifyRequest;
  reply: FastifyReply;
}
