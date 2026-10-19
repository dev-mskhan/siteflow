// apps/server/src/modules/auth/auth.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload } from './token.service.js';
import { UnauthorizedError, ForbiddenError } from './auth.errors.js';
import { authCacheService } from './auth.cache.service.js';
import { serverEnv } from '../../config/env.js';

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

  // 1. Check HttpOnly cookie (signed or raw in test)
  if (request.cookies && request.cookies['access_token']) {
    const rawCookie = request.cookies['access_token'];
    const unsigned = request.unsignCookie(rawCookie);
    if (unsigned.valid && unsigned.value) {
      token = unsigned.value;
    } else if (serverEnv.NODE_ENV === 'test' && !rawCookie.startsWith('s:')) {
      // Fallback for unsigned cookie in direct unit/integration tests
      token = rawCookie;
    }
  }

  // 2. Fall back to Authorization header
  if (!token && request.headers.authorization && request.headers.authorization.startsWith('Bearer ')) {
    token = request.headers.authorization.substring(7);
  }

  if (!token) {
    throw new UnauthorizedError('Authentication token missing');
  }

  const payload = verifyAccessToken(token);

  if (payload.status === 'SUSPENDED') {
    throw new ForbiddenError('Account is suspended');
  }

  // Validate session status against fast Redis revocation cache
  if (payload.sessionId) {
    const isRevoked = await authCacheService.isSessionRevoked(payload.sessionId);
    if (isRevoked) {
      throw new UnauthorizedError('Session has been revoked');
    }
  }

  const tokenIssuedAtMs = payload.iat ? payload.iat * 1000 : undefined;
  const isUserRevoked = await authCacheService.isUserRevoked(payload.sub, tokenIssuedAtMs);
  if (isUserRevoked) {
    throw new UnauthorizedError('Session has been revoked');
  }

  // Attach payload to request context
  request.user = payload;
  request.sessionId = payload.sessionId;
}
