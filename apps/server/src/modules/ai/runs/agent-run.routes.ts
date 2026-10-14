// apps/server/src/modules/ai/runs/agent-run.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import {
  handleStartRun,
  handleGetRun,
  handleListRuns,
  handleCancelRun,
} from './agent-run.handler.js';

/**
 * Agent run routes — all scoped under /:organizationId/ai/runs
 * Registered in app/index.ts under prefix /api/v1/organizations
 *
 * Route summary:
 *   POST   /:organizationId/ai/runs            → start a run (async, returns 202 + runId)
 *   GET    /:organizationId/ai/runs            → list runs (paginated)
 *   GET    /:organizationId/ai/runs/:runId     → get a single run
 *   DELETE /:organizationId/ai/runs/:runId     → cancel a queued/awaiting-approval run
 */
export const agentRunRoutes: FastifyPluginAsync = async (fastify) => {
  // All AI routes require a valid JWT and an org membership
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.post(
    '/:organizationId/ai/runs',
    { preHandler: [requirePermission('ai.runs.create')] },
    handleStartRun,
  );

  fastify.get(
    '/:organizationId/ai/runs',
    { preHandler: [requirePermission('ai.runs.read')] },
    handleListRuns,
  );

  fastify.get(
    '/:organizationId/ai/runs/:runId',
    { preHandler: [requirePermission('ai.runs.read')] },
    handleGetRun,
  );

  fastify.delete(
    '/:organizationId/ai/runs/:runId',
    { preHandler: [requirePermission('ai.runs.cancel')] },
    handleCancelRun,
  );
};
