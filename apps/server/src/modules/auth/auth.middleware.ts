// apps/server/src/modules/auth/auth.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload } from './token.service.js';
import { UnauthorizedError, ForbiddenError } from './auth.errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
    sessionId?: string;
  }
}

/**
 * Fastify preHandler hook to enforce authentication.
 * Checks for access_token cookie or Bearer Authorization header.
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  let token: string | undefined;

  // 1. Check HttpOnly cookie
  if (request.cookies && request.cookies['access_token']) {
    token = request.cookies['access_token'];
  }
  // 2. Fall back to Authorization header
  else if (request.headers.authorization && request.headers.authorization.startsWith('Bearer ')) {
    token = request.headers.authorization.substring(7);
  }

  if (!token) {
    throw new UnauthorizedError('Authentication token missing');
  }

  const payload = verifyAccessToken(token);

  if (payload.status === 'SUSPENDED') {
    throw new ForbiddenError('Account is suspended');
  }

  // Attach payload to request context
  request.user = payload;
}
