// apps/server/src/modules/ai/usage/ai-usage.repository.ts
// Phase 11.1 — AI Usage Tracking Repository
// Atomic operations for daily aggregation and monthly billing cycle queries.

import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { agentUsageDaily, type AgentUsageDaily, type NewAgentUsageDaily } from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';
import Decimal from 'decimal.js';

const logger = createLogger({ name: 'ai-usage-repository' });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IncrementUsageParams {
  organizationId: string;
  usageDate: string; // YYYY-MM-DD
  periodMonth: string; // YYYY-MM
  isTrialUsage: boolean;
  tokensIn: number;
  tokensOut: number;
  costUsd: string; // 6 decimal precision
  isSuccess: boolean;
}

export interface MonthlyUsageSummary {
  totalTokens: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: string;
  runCount: number;
  successfulRuns: number;
  failedRuns: number;
  daysWithUsage: number;
}

export interface DailyUsageRecord {
  usageDate: string;
  totalTokens: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: string;
  runCount: number;
  successfulRuns: number;
  failedRuns: number;
}

// ── Repository ────────────────────────────────────────────────────────────────

export class AiUsageRepository {
  private get db() {
    return getDb();
  }

  // ── Increment Daily Usage (Atomic Upsert) ────────────────────────────────

  /**
   * Atomically increment daily usage for an organization.
   * Uses PostgreSQL ON CONFLICT to handle race conditions safely.
   * This is called after each AI run completes.
   */
  async incrementDailyUsage(params: IncrementUsageParams): Promise<AgentUsageDaily> {
    const {
      organizationId,
      usageDate,
      periodMonth,
      isTrialUsage,
      tokensIn,
      tokensOut,
      costUsd,
      isSuccess,
    } = params;

    const totalTokens = tokensIn + tokensOut;
    const successIncrement = isSuccess ? 1 : 0;
    const failIncrement = isSuccess ? 0 : 1;

    logger.debug(
      {
        organizationId,
        usageDate,
        periodMonth,
        tokensIn,
        tokensOut,
        totalTokens,
        costUsd,
        isTrialUsage,
        isSuccess,
      },
      'Incrementing daily AI usage',
    );

    // Use raw SQL for ON CONFLICT UPDATE (Drizzle ORM limitation)
    const result = await this.db.execute<AgentUsageDaily>(sql`
      INSERT INTO app.agent_usage_daily (
        id,
        organization_id,
        usage_date,
        period_month,
        is_trial_usage,
        total_tokens_in,
        total_tokens_out,
        total_tokens,
        total_cost_usd,
        run_count,
        successful_runs,
        failed_runs,
        created_at,
        updated_at
      ) VALUES (
        ${generateId()},
        ${organizationId},
        ${usageDate},
        ${periodMonth},
        ${isTrialUsage},
        ${tokensIn},
        ${tokensOut},
        ${totalTokens},
        ${costUsd},
        1,
        ${successIncrement},
        ${failIncrement},
        NOW(),
        NOW()
      )
      ON CONFLICT (organization_id, usage_date)
      DO UPDATE SET
        total_tokens_in = app.agent_usage_daily.total_tokens_in + ${tokensIn},
        total_tokens_out = app.agent_usage_daily.total_tokens_out + ${tokensOut},
        total_tokens = app.agent_usage_daily.total_tokens + ${totalTokens},
        total_cost_usd = (
          CAST(app.agent_usage_daily.total_cost_usd AS NUMERIC) + CAST(${costUsd} AS NUMERIC)
        )::TEXT,
        run_count = app.agent_usage_daily.run_count + 1,
        successful_runs = app.agent_usage_daily.successful_runs + ${successIncrement},
        failed_runs = app.agent_usage_daily.failed_runs + ${failIncrement},
        updated_at = NOW()
      RETURNING *
    `);

    return result.rows[0]!;
  }

  // ── Get Monthly Usage (for Rate Limiting) ────────────────────────────────

  /**
   * Get total token usage for an organization in a specific billing month.
   * This is used for rate limiting checks before AI execution.
   * 
   * @param organizationId - Organization ID
   * @param periodMonth - Billing month in YYYY-MM format (e.g. '2027-02')
   * @returns Total tokens consumed in this billing period
   */
  async getMonthlyUsage(organizationId: string, periodMonth: string): Promise<MonthlyUsageSummary> {
    logger.debug({ organizationId, periodMonth }, 'Fetching monthly AI usage');

    const result = await this.db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${agentUsageDaily.totalTokens}), 0)`,
        totalTokensIn: sql<number>`COALESCE(SUM(${agentUsageDaily.totalTokensIn}), 0)`,
        totalTokensOut: sql<number>`COALESCE(SUM(${agentUsageDaily.totalTokensOut}), 0)`,
        totalCostUsd: sql<string>`COALESCE(SUM(CAST(${agentUsageDaily.totalCostUsd} AS NUMERIC)), 0)::TEXT`,
        runCount: sql<number>`COALESCE(SUM(${agentUsageDaily.runCount}), 0)`,
        successfulRuns: sql<number>`COALESCE(SUM(${agentUsageDaily.successfulRuns}), 0)`,
        failedRuns: sql<number>`COALESCE(SUM(${agentUsageDaily.failedRuns}), 0)`,
        daysWithUsage: sql<number>`COUNT(*)`,
      })
      .from(agentUsageDaily)
      .where(
        and(
          eq(agentUsageDaily.organizationId, organizationId),
          eq(agentUsageDaily.periodMonth, periodMonth),
        ),
      );

    const row = result[0];

    if (!row) {
      return {
        totalTokens: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCostUsd: '0.000000',
        runCount: 0,
        successfulRuns: 0,
        failedRuns: 0,
        daysWithUsage: 0,
      };
    }

    return {
      totalTokens: Number(row.totalTokens),
      totalTokensIn: Number(row.totalTokensIn),
      totalTokensOut: Number(row.totalTokensOut),
      totalCostUsd: new Decimal(row.totalCostUsd).toFixed(6),
      runCount: Number(row.runCount),
      successfulRuns: Number(row.successfulRuns),
      failedRuns: Number(row.failedRuns),
      daysWithUsage: Number(row.daysWithUsage),
    };
  }

  // ── Get Daily Usage ───────────────────────────────────────────────────────

  /**
   * Get usage for a specific day (for debugging or single-day reporting).
   */
  async getDailyUsage(organizationId: string, usageDate: string): Promise<AgentUsageDaily | undefined> {
    const result = await this.db
      .select()
      .from(agentUsageDaily)
      .where(and(eq(agentUsageDaily.organizationId, organizationId), eq(agentUsageDaily.usageDate, usageDate)))
      .limit(1);

    return result[0];
  }

  // ── Get Usage History (Date Range) ────────────────────────────────────────

  /**
   * Get daily usage records for a date range (for dashboard charts).
   * Returns ordered by date ascending.
   */
  async getUsageHistory(
    organizationId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyUsageRecord[]> {
    logger.debug({ organizationId, startDate, endDate }, 'Fetching usage history');

    const result = await this.db
      .select({
        usageDate: agentUsageDaily.usageDate,
        totalTokens: agentUsageDaily.totalTokens,
        totalTokensIn: agentUsageDaily.totalTokensIn,
        totalTokensOut: agentUsageDaily.totalTokensOut,
        totalCostUsd: agentUsageDaily.totalCostUsd,
        runCount: agentUsageDaily.runCount,
        successfulRuns: agentUsageDaily.successfulRuns,
        failedRuns: agentUsageDaily.failedRuns,
      })
      .from(agentUsageDaily)
      .where(
        and(
          eq(agentUsageDaily.organizationId, organizationId),
          gte(agentUsageDaily.usageDate, startDate),
          lte(agentUsageDaily.usageDate, endDate),
        ),
      )
      .orderBy(agentUsageDaily.usageDate);

    return result;
  }

  // ── Get Trial Usage (Analytics) ───────────────────────────────────────────

  /**
   * Get total trial usage across all organizations (for business analytics).
   * Q2 Decision: Track trial usage separately for analytics.
   */
  async getTrialUsageSummary(periodMonth: string): Promise<MonthlyUsageSummary> {
    const result = await this.db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${agentUsageDaily.totalTokens}), 0)`,
        totalTokensIn: sql<number>`COALESCE(SUM(${agentUsageDaily.totalTokensIn}), 0)`,
        totalTokensOut: sql<number>`COALESCE(SUM(${agentUsageDaily.totalTokensOut}), 0)`,
        totalCostUsd: sql<string>`COALESCE(SUM(CAST(${agentUsageDaily.totalCostUsd} AS NUMERIC)), 0)::TEXT`,
        runCount: sql<number>`COALESCE(SUM(${agentUsageDaily.runCount}), 0)`,
        successfulRuns: sql<number>`COALESCE(SUM(${agentUsageDaily.successfulRuns}), 0)`,
        failedRuns: sql<number>`COALESCE(SUM(${agentUsageDaily.failedRuns}), 0)`,
        daysWithUsage: sql<number>`COUNT(DISTINCT ${agentUsageDaily.organizationId})`,
      })
      .from(agentUsageDaily)
      .where(and(eq(agentUsageDaily.periodMonth, periodMonth), eq(agentUsageDaily.isTrialUsage, true)));

    const row = result[0];

    if (!row) {
      return {
        totalTokens: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCostUsd: '0.000000',
        runCount: 0,
        successfulRuns: 0,
        failedRuns: 0,
        daysWithUsage: 0,
      };
    }

    return {
      totalTokens: Number(row.totalTokens),
      totalTokensIn: Number(row.totalTokensIn),
      totalTokensOut: Number(row.totalTokensOut),
      totalCostUsd: new Decimal(row.totalCostUsd).toFixed(6),
      runCount: Number(row.runCount),
      successfulRuns: Number(row.successfulRuns),
      failedRuns: Number(row.failedRuns),
      daysWithUsage: Number(row.daysWithUsage),
    };
  }
}
