// apps/server/src/app/index.ts
// Fastify application factory — plugin registration, observability, and route mounting.
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { serverEnv } from '../config/env.js';
import { registerErrorHandlers } from '../middleware/error-handler.js';
import { healthRoutes } from '../modules/health/health.routes.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { organizationRoutes } from '../modules/organization/organization.routes.js';
import { membershipRoutes } from '../modules/membership/membership.routes.js';
import { invitationRoutes } from '../modules/invitation/invitation.routes.js';
import { auditRoutes } from '../modules/audit/audit.routes.js';

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
    // Allow OpenAPI-specific keywords (example, nullable, etc.) in route schemas
    ajv: {
      customOptions: {
        strict: false,
      },
    },
  });

  // ─── Core plugins ───────────────────────────────────────────────────────────
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: serverEnv.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });
  await app.register(sensible);
  await app.register(cookie, {
    secret: serverEnv.COOKIE_SECRET,
  });

  // ─── OpenAPI / Swagger ──────────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SiteFlow API',
        description: 'SiteFlow modular monolith API',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${serverEnv.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'access_token',
          },
        },
      },
      tags: [
        { name: 'health', description: 'Health & readiness checks' },
        { name: 'auth', description: 'Authentication & Session management' },
        { name: 'organizations', description: 'Organization management' },
        { name: 'members', description: 'Organization membership management' },
        { name: 'invitations', description: 'Organization invitation management' },
        { name: 'audit', description: 'Organization security audit trail' },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // ─── Global error & 404 handlers (must be before route plugins) ─────────────
  registerErrorHandlers(app);

  // ─── Route modules ──────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(organizationRoutes, { prefix: '/api/v1/organizations' });
  await app.register(membershipRoutes, { prefix: '/api/v1/organizations' });
  await app.register(invitationRoutes, { prefix: '/api/v1' });
  await app.register(auditRoutes, { prefix: '/api/v1/organizations' });

  return app;
}
