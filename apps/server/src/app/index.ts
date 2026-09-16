// apps/server/src/app/index.ts
// Fastify application factory — plugin registration, standardized API responses, and error tracking.
import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { trace, SpanStatusCode } from '@opentelemetry/api';

import { serverEnv } from '../config/env.js';
import { healthRoutes } from '../modules/health/health.routes.js';
import { createErrorResponse } from '../shared/response.js';

/**
 * Creates and configures the Fastify application instance.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: serverEnv.LOG_LEVEL,
      transport:
        serverEnv.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    genReqId: () => crypto.randomUUID(),
  });

  // ─── Core plugins ───────────────────────────────────────────────────────────
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: serverEnv.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });
  await app.register(sensible);

  // ─── OpenAPI / Swagger ──────────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SiteFlow API',
        description: 'SiteFlow modular monolith API',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${serverEnv.PORT}` }],
      tags: [{ name: 'health', description: 'Health & readiness checks' }],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // ─── Route modules ──────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' });

  // ─── Global Error Handler & Observability Trace Exception Tracking ─────────
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    const errObj = error as { statusCode?: number; message?: string; stack?: string };

    // 1. Trace exception correlation with OpenTelemetry
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.recordException(error);
      activeSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: errObj.message ?? 'Unhandled Error',
      });
    }

    // 2. Structured logging
    request.log.error(
      {
        err: error,
        reqId: request.id,
        url: request.raw.url,
        method: request.raw.method,
      },
      'Unhandled API Exception',
    );

    // 3. Status code determination
    const statusCode = errObj.statusCode ?? 500;
    const errorCode =
      statusCode === 400
        ? 'BAD_REQUEST'
        : statusCode === 401
          ? 'UNAUTHORIZED'
          : statusCode === 403
            ? 'FORBIDDEN'
            : statusCode === 404
              ? 'NOT_FOUND'
              : statusCode === 422
                ? 'UNPROCESSABLE_ENTITY'
                : 'INTERNAL_SERVER_ERROR';

    // 4. Standardized response format
    const responsePayload = createErrorResponse(
      errorCode,
      statusCode === 500 && serverEnv.NODE_ENV === 'production'
        ? 'Internal server error'
        : (errObj.message ?? 'Unknown error'),
      serverEnv.NODE_ENV === 'development' ? errObj.stack : undefined,
      request.id,
    );

    return reply.status(statusCode).send(responsePayload);
  });

  // ─── 404 Not Found Handler ──────────────────────────────────────────────
  app.setNotFoundHandler((request, reply) => {
    const payload = createErrorResponse(
      'NOT_FOUND',
      `Route ${request.method}:${request.url} not found`,
      undefined,
      request.id,
    );
    return reply.status(404).send(payload);
  });

  return app;
}
