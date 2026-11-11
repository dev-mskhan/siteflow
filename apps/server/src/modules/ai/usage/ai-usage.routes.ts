// apps/server/src/modules/ai/usage/ai-usage.routes.ts
// Phase 11.2 — AI Usage REST API Routes
// Endpoints for retrieving AI token usage data and monitoring billing limits.

import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import {
  handleGetCurrentUsage,
  handleGetUsageHistory,
} from './ai-usage.handler.js';
import {
  getCurrentUsageSchemaDoc,
  getUsageHistorySchemaDoc,
} from './ai-usage.schemas.js';

/**
 * AI usage routes — all scoped under /:organizationId/ai/usage
 * Registered in app/index.ts under prefix /api/v1/organizations
 *
 * Route summary:
 *   GET /:organizationId/ai/usage/current              → current month usage summary
 *   GET /:organizationId/ai/usage/history?start&end    → historical usage data
 *
 * Q3 Decision: All members can see usage (transparent awareness).
 */
export const aiUsageRoutes: FastifyPluginAsync = async (fastify) => {
  // All usage routes require authentication and org membership
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  /**
   * GET /:organizationId/ai/usage/current
   * Returns current billing month usage summary with limit progress.
   */
  fastify.get(
    '/:organizationId/ai/usage/current',
    {
      schema: getCurrentUsageSchemaDoc,
      preHandler: [requirePermission('ai.usage.read')],
    },
    handleGetCurrentUsage,
  );

  /**
   * GET /:organizationId/ai/usage/history
   * Returns daily usage records for a date range (for charts).
   * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), optional limit.
   */
  fastify.get(
    '/:organizationId/ai/usage/history',
    {
      schema: getUsageHistorySchemaDoc,
      preHandler: [requirePermission('ai.usage.read')],
    },
    handleGetUsageHistory,
  );
};
