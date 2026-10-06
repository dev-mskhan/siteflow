// apps/server/src/app/index.ts
// Fastify application factory — plugin registration, observability, and route mounting.
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { serverEnv } from '../config/env.js';
import { registerErrorHandlers } from '../middleware/error-handler.js';
import { healthRoutes } from '../modules/health/health.routes.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { organizationRoutes } from '../modules/organization/organization.routes.js';
import { profileRoutes } from '../modules/organization/profile/profile.routes.js';
import { settingsRoutes } from '../modules/organization/settings/settings.routes.js';
import { sequenceRoutes } from '../modules/organization/sequences/sequences.routes.js';
import { membershipRoutes } from '../modules/membership/membership.routes.js';
import { invitationRoutes } from '../modules/invitation/invitation.routes.js';
import { auditRoutes } from '../modules/audit/audit.routes.js';
import { projectRoutes } from '../modules/project/project.routes.js';
import { supplierRoutes } from '../modules/supplier/supplier.routes.js';
import { materialRoutes } from '../modules/material/material.routes.js';

/**
 * Creates and configures the Fastify application instance.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: serverEnv.LOG_LEVEL,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
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
    // Gap 6: hard limit on how long a request can stay alive
    connectionTimeout: 30000,
    requestTimeout: serverEnv.REQUEST_TIMEOUT_MS,
    // Gap G.1: cap request body size to prevent memory exhaustion
    bodyLimit: serverEnv.BODY_LIMIT_BYTES,
  });

  // ─── Core plugins ───────────────────────────────────────────────────────────
  await app.register(helmet, { global: true });

  // Gap 4: parse CORS_ORIGIN (comma-separated) into an array so production
  // clients get proper CORS headers instead of origin: false blocking them.
  const allowedOrigins = serverEnv.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  await app.register(cors, {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  // Gap 5: global rate limit — 300 req/min per authenticated user (falls back to IP)
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const ctx = (req as any).orgContext;
      return ctx?.userId ?? req.ip;
    },
  });

  await app.register(sensible);
  const cookieSigner = {
    sign: (value: string) => `s:${cookie.sign(value, serverEnv.COOKIE_SECRET)}`,
    unsign: (input: string) => {
      if (input.startsWith('s:')) {
        return cookie.unsign(input.slice(2), serverEnv.COOKIE_SECRET);
      }
      return cookie.unsign(input, serverEnv.COOKIE_SECRET);
    },
  };

  await app.register(cookie, {
    secret: cookieSigner,
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
        { name: 'profiles', description: 'Organization profile management' },
        { name: 'settings', description: 'Organization settings management' },
        { name: 'document-sequences', description: 'Organization document sequence management' },
        { name: 'members', description: 'Organization membership management' },
        { name: 'invitations', description: 'Organization invitation management' },
        { name: 'audit', description: 'Organization security audit trail' },
        { name: 'projects', description: 'Project management' },
        { name: 'suppliers', description: 'Organization supplier directory' },
        { name: 'materials', description: 'Organization material catalog' },
        { name: 'subcontractors', description: 'Project subcontractor management' },
        { name: 'material-requests', description: 'Project material requests' },
        { name: 'quotes', description: 'Supplier quotes' },
        { name: 'procurement-approvals', description: 'Procurement approval workflow' },
        { name: 'purchase-orders', description: 'Purchase orders' },
        { name: 'committed-costs', description: 'Committed cost tracking' },
        { name: 'deliveries', description: 'Deliveries and logistics' },
        { name: 'receipts', description: 'Goods receipts' },
        { name: 'inventory', description: 'Project inventory ledger' },
        { name: 'performance', description: 'Supplier and subcontractor performance' },
        { name: 'documents', description: 'Project document management and evidence' },
        { name: 'compliance', description: 'Project permits, inspections, and compliance records' },
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

  // Gap 5: auth routes get a stricter rate limit — 10 req per 15 min per IP
  await app.register(
    async (authScope) => {
      await authScope.register(rateLimit, {
        max: 10,
        timeWindow: '15 minutes',
        keyGenerator: (req) => req.ip,
      });
      await authScope.register(authRoutes);
    },
    { prefix: '/api/v1/auth' },
  );

  await app.register(organizationRoutes, { prefix: '/api/v1/organizations' });
  await app.register(profileRoutes, { prefix: '/api/v1/organizations' });
  await app.register(settingsRoutes, { prefix: '/api/v1/organizations' });
  await app.register(sequenceRoutes, { prefix: '/api/v1/organizations' });
  await app.register(membershipRoutes, { prefix: '/api/v1/organizations' });
  await app.register(invitationRoutes, { prefix: '/api/v1' });
  await app.register(auditRoutes, { prefix: '/api/v1/organizations' });
  await app.register(projectRoutes, { prefix: '/api/v1/organizations' });
  await app.register(supplierRoutes, { prefix: '/api/v1/organizations' });
  await app.register(materialRoutes, { prefix: '/api/v1/organizations' });

  return app;
}
