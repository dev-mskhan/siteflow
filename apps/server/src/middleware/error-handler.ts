// apps/server/src/middleware/error-handler.ts
// Global Fastify error handler — registered as middleware before route plugins.
// Converts ZodError, AuthError, and generic Fastify/Node errors into the
// standardised { success, error } API response shape.
import type { FastifyInstance, FastifyError } from 'fastify';
import { trace, SpanStatusCode } from '@opentelemetry/api';

import { serverEnv } from '../config/env.js';
import { AuthError } from '../modules/auth/auth.errors.js';
import { createErrorResponse } from '../shared/response.js';

function resolveStatusCode(error: FastifyError | Error | AuthError): number {
  if (error.name === 'ZodError' || error.constructor?.name === 'ZodError') return 422;
  // Fastify JSON Schema validation errors — treat as semantic 422 (same as Zod)
  if ((error as FastifyError).code === 'FST_ERR_VALIDATION') return 422;
  if (error instanceof AuthError) return error.statusCode;
  // PostgreSQL invalid input syntax for type uuid (e.g. ULID passed as UUID param)
  if ((error as any).code === '22P02') return 400;
  return (error as FastifyError).statusCode ?? 500;
}

function resolveErrorCode(error: FastifyError | Error | AuthError, statusCode: number): string {
  if (error.name === 'ZodError' || error.constructor?.name === 'ZodError') return 'VALIDATION_ERROR';
  if ((error as FastifyError).code === 'FST_ERR_VALIDATION') return 'VALIDATION_ERROR';
  if (error instanceof AuthError) return error.code;
  if ((error as any).code === '22P02') return 'VALIDATION_ERROR';

  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
  };
  return map[statusCode] ?? 'INTERNAL_SERVER_ERROR';
}

/**
 * Registers the global error handler and 404 not-found handler onto the Fastify instance.
 * Must be called BEFORE registering route plugins so child scopes inherit it.
 */
export function registerErrorHandlers(app: FastifyInstance): void {
  // ─── Global Error Handler ──────────────────────────────────────────────────
  app.setErrorHandler((error: FastifyError | Error | AuthError, request, reply) => {
    try {
      const isZodError = Boolean(
        error && (error.name === 'ZodError' || error.constructor?.name === 'ZodError'),
      );

      const statusCode = resolveStatusCode(error);
      const errorCode = resolveErrorCode(error, statusCode);

      // 1. OpenTelemetry span exception tracking
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        activeSpan.recordException(error);
        activeSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message ?? 'Unhandled Error' });
        activeSpan.setAttribute('error.code', errorCode);
        activeSpan.setAttribute('http.status_code', statusCode);
        if (request.orgContext) {
          activeSpan.setAttribute('organization.id', request.orgContext.organizationId);
          activeSpan.setAttribute('user.id', request.orgContext.userId);
        }
      }

      // 2. Structured pino logging
      request.log.error(
        {
          err: {
            name: error.name,
            message: error.message,
            code: (error as any).code,
            stack: error.stack,
          },
          reqId: request.id,
          url: request.raw?.url,
          method: request.raw?.method,
        },
        'Unhandled API Exception',
      );

      // 3. Standardised response payload
      const details = isZodError && 'issues' in error
        ? (error as any).issues
        : serverEnv.NODE_ENV === 'development'
          ? error.stack
          : undefined;

      const responsePayload = createErrorResponse(
        errorCode,
        statusCode === 500 && serverEnv.NODE_ENV === 'production'
          ? 'Internal server error'
          : (error as any).code === '22P02'
            ? 'Invalid ID format in request'
            : (error.message ?? 'Unknown error'),
        details,
        request.id,
      );

      return reply.status(statusCode).send(responsePayload);
    } catch (handlerErr) {
      console.error('CRITICAL ERROR IN FASTIFY ERROR HANDLER:', handlerErr);
      const fallback = createErrorResponse('INTERNAL_SERVER_ERROR', 'Internal server error', undefined, request.id);
      return reply.status(500).send(fallback);
    }
  });

  // ─── 404 Not Found Handler ─────────────────────────────────────────────────
  app.setNotFoundHandler((request, reply) => {
    const payload = createErrorResponse(
      'NOT_FOUND',
      `Route ${request.method}:${request.url} not found`,
      undefined,
      request.id,
    );
    return reply.status(404).send(payload);
  });
}
