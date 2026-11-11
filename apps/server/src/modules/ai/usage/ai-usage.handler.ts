// apps/server/src/modules/ai/usage/ai-usage.handler.ts
// Phase 11.2 — AI Usage HTTP Handlers
// Request handlers for AI usage monitoring endpoints.

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@siteflow/observability/server';
import { AiUsageService } from './ai-usage.service.js';
import { AiUsageRepository } from './ai-usage.repository.js';
import { EntitlementService } from '../../billing/entitlement.service.js';
import { NoActiveSubscriptionError } from '../core/errors.js';
import { createSuccessResponse } from '../../../shared/response.js';

const logger = createLogger({ name: 'ai-usage-handler' });

// ── Request/Response Types ────────────────────────────────────────────────────

interface CurrentUsageParams {
  organizationId: string;
}

interface UsageHistoryParams {
  organizationId: string;
}

interface UsageHistoryQuery {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  limit?: number;     // Max days to return
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /:organizationId/ai/usage/current
 * Returns current billing month usage summary.
 */
export async function handleGetCurrentUsage(
  req: FastifyRequest<{ Params: CurrentUsageParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId } = req.params;

  logger.debug({ organizationId }, 'Fetching current AI usage');

  try {
    const usageService = new AiUsageService(
      new AiUsageRepository(),
      new EntitlementService(),
    );

    const usage = await usageService.getCurrentMonthUsage(organizationId);

    return reply.status(200).send(
      createSuccessResponse({
        usage: {
          used: usage.used,
          limit: usage.limit,
          remaining: usage.remaining,
          percentUsed: Number(usage.percentUsed.toFixed(2)),
          isNearLimit: usage.isNearLimit,
          resetDate: usage.resetDate.toISOString(),
          costUsd: usage.costUsd,
          runCount: usage.runCount,
          successfulRuns: usage.successfulRuns,
          failedRuns: usage.failedRuns,
          daysWithUsage: usage.daysWithUsage,
        },
      }),
    );
  } catch (err) {
    if (err instanceof NoActiveSubscriptionError) {
      return reply.status(403).send({
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: err.message,
      });
    }

    logger.error({ organizationId, err }, 'Failed to fetch current AI usage');
    throw err;
  }
}

/**
 * GET /:organizationId/ai/usage/history?startDate&endDate&limit
 * Returns daily usage records for a date range.
 */
export async function handleGetUsageHistory(
  req: FastifyRequest<{ Params: UsageHistoryParams; Querystring: UsageHistoryQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId } = req.params;
  const { startDate, endDate, limit } = req.query;

  logger.debug({ organizationId, startDate, endDate, limit }, 'Fetching AI usage history');

  // Validate date parameters
  if (!startDate || !endDate) {
    return reply.status(400).send({
      error: 'INVALID_PARAMETERS',
      message: 'startDate and endDate query parameters are required (YYYY-MM-DD format).',
    });
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return reply.status(400).send({
      error: 'INVALID_DATE_FORMAT',
      message: 'Dates must be in YYYY-MM-DD format.',
    });
  }

  // Validate date range (max 90 days)
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return reply.status(400).send({
      error: 'INVALID_DATE_RANGE',
      message: 'startDate must be before or equal to endDate.',
    });
  }

  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 90) {
    return reply.status(400).send({
      error: 'DATE_RANGE_TOO_LARGE',
      message: 'Date range cannot exceed 90 days.',
    });
  }

  try {
    const usageService = new AiUsageService(
      new AiUsageRepository(),
      new EntitlementService(),
    );

    const history = await usageService.getUsageHistory(organizationId, start, end);

    // Apply limit if provided
    const limitedHistory = limit ? history.slice(0, limit) : history;

    return reply.status(200).send(
      createSuccessResponse({
        history: limitedHistory.map((day) => ({
          date: day.usageDate,
          totalTokens: day.totalTokens,
          tokensIn: day.totalTokensIn,
          tokensOut: day.totalTokensOut,
          costUsd: day.totalCostUsd,
          runCount: day.runCount,
          successfulRuns: day.successfulRuns,
          failedRuns: day.failedRuns,
        })),
        meta: {
          startDate,
          endDate,
          totalDays: history.length,
          returned: limitedHistory.length,
        },
      }),
    );
  } catch (err) {
    if (err instanceof NoActiveSubscriptionError) {
      return reply.status(403).send({
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: err.message,
      });
    }

    logger.error({ organizationId, startDate, endDate, err }, 'Failed to fetch AI usage history');
    throw err;
  }
}
