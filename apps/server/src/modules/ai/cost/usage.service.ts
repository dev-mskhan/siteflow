// apps/server/src/modules/ai/cost/usage.service.ts
//
// Records token usage and cost for every LLM call, accumulates totals
// per run in memory, and upserts the daily org aggregate at run completion.
//
// Design:
//   - Per-run accumulator lives in-memory inside the UsageAccumulator class.
//     It is created by the runner at the start of a run and passed to model-factory.
//   - At run end (success or failure), the worker calls flush() which writes
//     to agent_usage_daily via AgentRunRepository.upsertUsageDaily().
//   - The run-level totals (tokensIn, tokensOut, costUsd) are written to
//     agent_runs by agent-run.service.markSucceeded / markFailed.

import { createLogger } from '@siteflow/observability/server';
import { calculateCostUsd } from './pricing.js';
import type { RunContext } from '../core/run-context.js';
import { AgentRunRepository } from '../runs/agent-run.repository.js';

const logger = createLogger({ name: 'ai-usage-service' });

// ── Per-call record ───────────────────────────────────────────────────────────

export interface UsageRecord {
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: string;
  /** ISO timestamp of the call */
  calledAt: string;
}

// ── Per-run accumulator ───────────────────────────────────────────────────────
// Created once per run by the runner, discarded after flush().

export class UsageAccumulator {
  private _tokensIn  = 0;
  private _tokensOut = 0;
  private _calls: UsageRecord[] = [];

  constructor(private readonly ctx: RunContext) {}

  /**
   * Record a completed LLM call.
   * Called by model-factory's callback hook after every invoke().
   */
  record(modelId: string, tokensIn: number, tokensOut: number): UsageRecord {
    const costUsd = calculateCostUsd(modelId, tokensIn, tokensOut);
    const record: UsageRecord = {
      modelId,
      tokensIn,
      tokensOut,
      costUsd,
      calledAt: new Date().toISOString(),
    };
    this._tokensIn  += tokensIn;
    this._tokensOut += tokensOut;
    this._calls.push(record);

    logger.debug(
      { runId: this.ctx.runId, modelId, tokensIn, tokensOut, costUsd },
      'LLM call usage recorded',
    );

    return record;
  }

  // ── Read-only accessors (used by budget-guard) ────────────────────────────

  get tokensIn():  number { return this._tokensIn;  }
  get tokensOut(): number { return this._tokensOut; }
  get totalTokens(): number { return this._tokensIn + this._tokensOut; }

  get totalCostUsd(): string {
    const total = this._calls.reduce(
      (sum, r) => sum + parseFloat(r.costUsd),
      0,
    );
    return total.toFixed(6);
  }

  get calls(): readonly UsageRecord[] { return this._calls; }

  // ── Flush — called once at run completion ─────────────────────────────────

  /**
   * Upserts the daily aggregate for this run's org+agent.
   * Safe to call on both success and failure paths.
   */
  async flush(): Promise<void> {
    if (this._calls.length === 0) return;

    const repo = new AgentRunRepository();
    const day  = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    try {
      await repo.upsertUsageDaily({
        organizationId: this.ctx.organizationId,
        agent: this.ctx.agent,
        day,
        tokensIn:  this._tokensIn,
        tokensOut: this._tokensOut,
        costUsd:   this.totalCostUsd,
      });

      logger.info(
        {
          runId: this.ctx.runId,
          day,
          tokensIn: this._tokensIn,
          tokensOut: this._tokensOut,
          costUsd: this.totalCostUsd,
          callCount: this._calls.length,
        },
        'Run usage flushed to daily aggregate',
      );
    } catch (err) {
      // Non-fatal — cost tracking failure must not crash the run result
      logger.error({ runId: this.ctx.runId, err }, 'Failed to flush usage to daily aggregate');
    }
  }
}
