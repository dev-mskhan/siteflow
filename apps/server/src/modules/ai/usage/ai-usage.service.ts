// apps/server/src/modules/ai/usage/ai-usage.service.ts
// Phase 11.1 — AI Usage Service with Rate Limiting
// Enforces monthly AI token limits based on subscription billing cycles.

import { createLogger } from '@siteflow/observability/server';
import { AiUsageRepository, type MonthlyUsageSummary } from './ai-usage.repository.js';
import { EntitlementService } from '../../billing/entitlement.service.js';
import { APPROVED_LIMITS, type PlanLimits } from '@siteflow/shared';
import Decimal from 'decimal.js';

const logger = createLogger({ name: 'ai-usage-service' });

// ── Error Classes ─────────────────────────────────────────────────────────────

/**
 * Thrown when organization has reached monthly AI token limit.
 * Q5 Decision: Hard stop (fail-closed, no surprise charges).
 * Maps to HTTP 429 Too Many Requests.
 */
export class AiUsageLimitExceededError extends Error {
  public readonly code = 'AI_USAGE_LIMIT_EXCEEDED';
  public readonly statusCode = 429;
  public readonly used: number;
  public readonly limit: number;
  public readonly resetDate: Date;

  constructor(details: { used: number; limit: number; resetDate: Date }) {
    super(
      `Monthly AI token limit reached (${details.used.toLocaleString()}/${details.limit.toLocaleString()} tokens). ` +
        `Resets on ${details.resetDate.toISOString().split('T')[0]}.`,
    );
    this.name = 'AiUsageLimitExceededError';
    this.used = details.used;
    this.limit = details.limit;
    this.resetDate = details.resetDate;
  }
}

/**
 * Thrown when organization has no active subscription or trial.
 */
export class NoActiveSubscriptionError extends Error {
  public readonly code = 'NO_ACTIVE_SUBSCRIPTION';
  public readonly statusCode = 403;

  constructor(message = 'No active subscription or trial found. AI features require an active plan.') {
    super(message);
    this.name = 'NoActiveSubscriptionError';
  }
}

// ── Request/Response Types ────────────────────────────────────────────────────

export interface RecordUsageParams {
  organizationId: string;
  runId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: string;
  usageDate: Date;
  isSuccess: boolean;
}

export interface UsageSummary {
  used: number; // Total tokens used
  limit: number; // Monthly limit
  remaining: number; // Tokens remaining
  percentUsed: number; // Percentage (0-100)
  resetDate: Date; // When the limit resets
  costUsd: string; // Total cost this period
  runCount: number;
  successfulRuns: number;
  failedRuns: number;
  daysWithUsage: number;
  isNearLimit: boolean; // True if >=90% used
}

// ── Service ───────────────────────────────────────────────────────────────────

export class AiUsageService {
  constructor(
    private readonly repo: AiUsageRepository,
    private readonly entitlementService: EntitlementService,
  ) {}

  // ── Pre-flight: Check if AI execution is allowed ──────────────────────────

  /**
   * Check if organization can execute an AI run (pre-flight check).
   * Enforces monthly token limits based on subscription billing cycle.
   *
   * Q1 Decision: Hard reset at currentPeriodStart (aligns with Stripe billing).
   * Q4 Decision: AI continues during 7-day payment grace period.
   * Q5 Decision: Hard stop when limit reached (no overage).
   *
   * @throws NoActiveSubscriptionError if no active subscription/trial
   * @throws AiUsageLimitExceededError if monthly limit reached
   */
  async checkUsageAllowed(organizationId: string): Promise<void> {
    logger.debug({ organizationId }, 'Checking AI usage limit (pre-flight)');

    // 1. Get effective limits from subscription/trial
    const entitlement = await this.entitlementService.resolveEffectiveLimits(organizationId);

    if (!entitlement.limits) {
      throw new NoActiveSubscriptionError();
    }

    // Q4 Decision: Allow AI during grace period (even if PAST_DUE)
    const isInGrace = entitlement.state === 'PAST_DUE' && entitlement.graceStartsAt;
    const allowedStates = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

    if (!allowedStates.includes(entitlement.state)) {
      throw new NoActiveSubscriptionError(
        `Subscription is ${entitlement.state}. AI features require an active plan.`,
      );
    }

    // 2. Calculate current billing period
    const now = new Date();
    const periodMonth = this.formatPeriodMonth(now);

    // 3. Get current month usage
    const usage = await this.repo.getMonthlyUsage(organizationId, periodMonth);

    // 4. Check against limit
    const monthlyLimit = entitlement.limits.aiTokensMonthly;

    if (usage.totalTokens >= monthlyLimit) {
      // Q5 Decision: Hard stop when limit reached
      const resetDate = this.calculateResetDate(now);

      logger.warn(
        {
          organizationId,
          used: usage.totalTokens,
          limit: monthlyLimit,
          resetDate,
        },
        'AI usage limit exceeded',
      );

      throw new AiUsageLimitExceededError({
        used: usage.totalTokens,
        limit: monthlyLimit,
        resetDate,
      });
    }

    // Log near-limit warning
    const percentUsed = (usage.totalTokens / monthlyLimit) * 100;
    if (percentUsed >= 90) {
      logger.warn(
        {
          organizationId,
          used: usage.totalTokens,
          limit: monthlyLimit,
          percentUsed: percentUsed.toFixed(1),
        },
        'AI usage approaching limit',
      );
    }
  }

  // ── Post-execution: Record usage ──────────────────────────────────────────

  /**
   * Record AI usage after a run completes.
   * Updates daily aggregation atomically via repository upsert.
   *
   * Q2 Decision: Track trial usage separately via isTrialUsage flag.
   */
  async recordRunUsage(params: RecordUsageParams): Promise<void> {
    const { organizationId, runId, tokensIn, tokensOut, costUsd, usageDate, isSuccess } = params;

    logger.debug(
      {
        organizationId,
        runId,
        tokensIn,
        tokensOut,
        costUsd,
        isSuccess,
      },
      'Recording AI run usage',
    );

    // Get subscription to determine if trial usage
    const entitlement = await this.entitlementService.resolveEffectiveLimits(organizationId);
    const isTrialUsage = entitlement.state === 'TRIALING';

    // Format dates
    const usageDateStr = this.formatUsageDate(usageDate);
    const periodMonth = this.formatPeriodMonth(usageDate);

    // Atomic increment
    await this.repo.incrementDailyUsage({
      organizationId,
      usageDate: usageDateStr,
      periodMonth,
      isTrialUsage,
      tokensIn,
      tokensOut,
      costUsd,
      isSuccess,
    });

    logger.info(
      {
        organizationId,
        runId,
        usageDate: usageDateStr,
        periodMonth,
        tokensTotal: tokensIn + tokensOut,
        isTrialUsage,
      },
      'AI usage recorded',
    );
  }

  // ── Get current month usage summary ───────────────────────────────────────

  /**
   * Get usage summary for current billing month.
   * Used by dashboard UI to show usage progress.
   *
   * Q3 Decision: All members can see usage (transparent awareness).
   */
  async getCurrentMonthUsage(organizationId: string): Promise<UsageSummary> {
    logger.debug({ organizationId }, 'Fetching current month AI usage summary');

    // Get limits
    const entitlement = await this.entitlementService.resolveEffectiveLimits(organizationId);

    if (!entitlement.limits) {
      throw new NoActiveSubscriptionError();
    }

    const limit = entitlement.limits.aiTokensMonthly;

    // Get usage for current month
    const now = new Date();
    const periodMonth = this.formatPeriodMonth(now);
    const usage = await this.repo.getMonthlyUsage(organizationId, periodMonth);

    // Calculate summary
    const used = usage.totalTokens;
    const remaining = Math.max(0, limit - used);
    const percentUsed = (used / limit) * 100;
    const isNearLimit = percentUsed >= 90;
    const resetDate = this.calculateResetDate(now);

    return {
      used,
      limit,
      remaining,
      percentUsed: Math.min(100, percentUsed),
      resetDate,
      costUsd: usage.totalCostUsd,
      runCount: usage.runCount,
      successfulRuns: usage.successfulRuns,
      failedRuns: usage.failedRuns,
      daysWithUsage: usage.daysWithUsage,
      isNearLimit,
    };
  }

  // ── Get usage history for dashboard charts ────────────────────────────────

  /**
   * Get daily usage history for a date range.
   * Used for dashboard charts and analytics.
   */
  async getUsageHistory(organizationId: string, startDate: Date, endDate: Date) {
    const startStr = this.formatUsageDate(startDate);
    const endStr = this.formatUsageDate(endDate);

    return this.repo.getUsageHistory(organizationId, startStr, endStr);
  }

  // ── Utility Methods ───────────────────────────────────────────────────────

  /**
   * Format date as YYYY-MM-DD (UTC).
   */
  private formatUsageDate(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Format date as YYYY-MM (UTC).
   * Q1 Decision: Billing period aligned with currentPeriodStart.
   */
  private formatPeriodMonth(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Calculate when the usage limit resets (first day of next month).
   * Q1 Decision: Hard reset at currentPeriodStart.
   * For simplicity, we use first day of next month (actual subscription
   * periods may vary, but this is close enough for UI display).
   */
  private calculateResetDate(now: Date): Date {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    // First day of next month
    const resetDate = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
    return resetDate;
  }
}
