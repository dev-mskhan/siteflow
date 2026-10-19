import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import { ensureRedisConnected } from '../../lib/redis/redis.js';
import { getStorageService } from '../../lib/storage/index.js';
import { createSuccessResponse } from '../../shared/response.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'health' });

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /health — liveness probe (fast, no dependency checks) ──────────────
  app.get(
    '/',
    {
      schema: {
        description: 'Liveness check — fast, no dependency checks',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  uptime: { type: 'number' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send(
        createSuccessResponse({
          status: 'ok',
          uptime: process.uptime(),
        }),
      );
    },
  );

  // ── GET /health/ready — readiness probe (checks DB + Redis + Storage) ───────
  app.get(
    '/ready',
    {
      schema: {
        description: 'Readiness check — verifies DB, Redis, and Storage connectivity',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ready', 'degraded'] },
                  checks: {
                    type: 'object',
                    properties: {
                      db: { type: 'string', enum: ['ok', 'fail'] },
                      redis: { type: 'string', enum: ['ok', 'fail'] },
                      storage: { type: 'string', enum: ['ok', 'fail'] },
                    },
                  },
                },
              },
            },
          },
          503: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['degraded'] },
                  checks: {
                    type: 'object',
                    properties: {
                      db: { type: 'string', enum: ['ok', 'fail'] },
                      redis: { type: 'string', enum: ['ok', 'fail'] },
                      storage: { type: 'string', enum: ['ok', 'fail'] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const checks = {
        db: 'ok' as 'ok' | 'fail',
        redis: 'ok' as 'ok' | 'fail',
        storage: 'ok' as 'ok' | 'fail',
      };

      // Ping PostgreSQL
      try {
        await getDb().execute(sql`SELECT 1`);
      } catch (err) {
        logger.warn({ err }, 'Readiness check: DB ping failed');
        checks.db = 'fail';
      }

      // Ping Redis
      try {
        const redis = await ensureRedisConnected();
        const pong = await redis.ping();
        if (pong !== 'PONG') checks.redis = 'fail';
      } catch (err) {
        logger.warn({ err }, 'Readiness check: Redis ping failed');
        checks.redis = 'fail';
      }

      // Ping MinIO / object storage (presigned URL generation is a lightweight connectivity probe)
      try {
        await getStorageService().putPresignedUrl('health/probe.tmp', 'application/octet-stream', 10);
      } catch (err) {
        logger.warn({ err }, 'Readiness check: Storage ping failed');
        checks.storage = 'fail';
      }

      const isReady = checks.db === 'ok' && checks.redis === 'ok' && checks.storage === 'ok';
      const status = isReady ? 'ready' : 'degraded';
      const httpStatus = isReady ? 200 : 503;

      return reply.status(httpStatus).send(
        createSuccessResponse({ status, checks }),
      );
    },
  );
};
