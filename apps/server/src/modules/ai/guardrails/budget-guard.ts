// apps/server/src/modules/ai/guardrails/budget-guard.ts
//
// Enforces two hard limits before every LLM call:
//
//   1. Per-run token cap (from RunContext.limits.maxTokens)
//      Checked against the UsageAccumulator's in-memory running total.
//      Fast — no DB hit.
//
//   2. Per-org daily spend cap (from AI_DAILY_BUDGET_USD env var)
//      Checked against agent_usage_daily (DB read, once per run invocation,
//      cached for the lifetime of the UsageAccumulator).
//      Throws BudgetExceededError if the org is at or over the limit.
//
// The runner calls assertBudget() before each LLM node execution.
// Any throw causes the run to transition to FAILED via runner error handling.

import { createLogger } from '@siteflow/observability/server';
import { serverEnv } from '../../../config/env.js';
import { AgentRunRepository } from '../runs/agent-run.repository.js';
import {
  BudgetExceededError,
  MaxTokensExceededError,
} from '../core/errors.js';
import type { RunContext } from '../core/run-context.js';
import type { UsageAccumulator } from '../cost/usage.service.js';

const logger = createLogger({ name: 'ai-budget-guard' });

// ── Daily spend cache (per guard instance) ────────────────────────────────────
// We cache the daily spend check within a single run to avoid a DB round-trip
// on every graph node. The cache is invalidated once the run's own cost pushes
// past the threshold (conservative — stops one run over budget, not all future).

export class BudgetGuard {
  private cachedDailySpend: number | null = null;
  private readonly repo = new AgentRunRepository();

  constructor(
    private readonly ctx: RunContext,
    private readonly accumulator: UsageAccumulator,
  ) {}

  /**
   * Assert that this run is within its token and budget limits.
   * Call this at the start of every LLM graph node.
   *
   * Throws:
   *   MaxTokensExceededError  — run has consumed ctx.limits.maxTokens tokens
   *   BudgetExceededError     — org has exceeded AI_DAILY_BUDGET_USD today
   */
  async assertBudget(): Promise<void> {
    this.assertTokenLimit();
    await this.assertDailyBudget();
  }

  // ── Per-run token limit (in-memory, no DB) ────────────────────────────────

  private assertTokenLimit(): void {
    const { maxTokens } = this.ctx.limits;
    const used = this.accumulator.totalTokens;

    if (used >= maxTokens) {
      logger.warn(
        { runId: this.ctx.runId, used, maxTokens },
        'Run exceeded token limit',
      );
      throw new MaxTokensExceededError(this.ctx.runId, maxTokens);
    }
  }

  // ── Per-org daily budget (DB-backed, cached per run) ─────────────────────

  private async assertDailyBudget(): Promise<void> {
    const limitUsd = serverEnv.AI_DAILY_BUDGET_USD;

    // 0 means unlimited — skip DB check entirely
    if (limitUsd === 0) return;

    const today = new Date().toISOString().slice(0, 10);

    // Fetch from DB on first call, then use cached value + accumulate in-memory delta
    if (this.cachedDailySpend === null) {
      try {
        this.cachedDailySpend = await this.repo.getDailySpend(
          this.ctx.organizationId,
          today,
        );
      } catch (err) {
        // Fail-open: if we can't read the spend, don't block the run.
        // Log loudly so ops can investigate.
        logger.error(
          { runId: this.ctx.runId, err },
          'Budget guard: failed to read daily spend — failing open',
        );
        return;
      }
    }

    // Add the current run's cost (not yet flushed to DB) to the cached baseline
    const effectiveSpend =
      this.cachedDailySpend + parseFloat(this.accumulator.totalCostUsd);

    if (effectiveSpend >= limitUsd) {
      logger.warn(
        {
          organizationId: this.ctx.organizationId,
          effectiveSpend,
          limitUsd,
          runId: this.ctx.runId,
        },
        'Organization exceeded daily AI budget',
      );
      throw new BudgetExceededError(
        this.ctx.organizationId,
        limitUsd,
        effectiveSpend,
      );
    }
  }

  /**
   * Invalidates the cached daily spend so the next assertBudget() re-reads from DB.
   * Call this after a run completes and flushes usage — useful in tests.
   */
  invalidateCache(): void {
    this.cachedDailySpend = null;
  }
}
