// apps/server/src/modules/ai/evals/harness.ts
//
// Runs an agent against a golden dataset and scores it.
// Intended for CI and offline quality checks — never runs in the HTTP path.
//
// Usage:
//   import { runEval } from './harness.js';
//   const results = await runEval('cost-financial', dataset, scorers);

import { randomUUID } from 'node:crypto';
import { createLogger } from '@siteflow/observability/server';
import { buildRunContext } from '../core/run-context.js';
import { executeRun } from '../graph/runner.js';
import { recordTraceScore } from '../observability/tracing.js';
import type { AgentName } from '../core/types.js';
import type { AgentRunOutput } from '../core/types.js';

const logger = createLogger({ name: 'ai-eval-harness' });

// ── Dataset types ─────────────────────────────────────────────────────────────

export interface EvalCase {
  id: string;
  description: string;
  /** Minimal RunContext fields needed to build a context for this case */
  context: {
    organizationId: string;
    projectId?: string;
    userId: string;
  };
  /** Input passed to the graph as inputSnapshot */
  input: Record<string, unknown>;
  /** Optional expected values — scorers use these */
  expected?: Record<string, unknown>;
}

// ── Scorer types ──────────────────────────────────────────────────────────────

export interface ScorerInput {
  evalCase: EvalCase;
  output: AgentRunOutput | null;
  error: string | null;
  durationMs: number;
}

export interface ScorerResult {
  name: string;
  passed: boolean;
  score: number; // 0.0 – 1.0
  reason: string;
}

export type Scorer = (input: ScorerInput) => ScorerResult | Promise<ScorerResult>;

// ── Per-case result ───────────────────────────────────────────────────────────

export interface EvalCaseResult {
  caseId: string;
  description: string;
  passed: boolean;
  durationMs: number;
  output: AgentRunOutput | null;
  error: string | null;
  scores: ScorerResult[];
}

// ── Harness ───────────────────────────────────────────────────────────────────

export interface EvalSummary {
  agent: AgentName;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  cases: EvalCaseResult[];
}

export async function runEval(
  agent: AgentName,
  dataset: EvalCase[],
  scorers: Scorer[],
): Promise<EvalSummary> {
  logger.info({ agent, total: dataset.length }, 'Starting eval run');

  const results: EvalCaseResult[] = [];

  for (const evalCase of dataset) {
    const start = Date.now();
    let output: AgentRunOutput | null = null;
    let error: string | null = null;
    let traceId: string | undefined;

    try {
      // Use a unique UUID so concurrent/repeated evals never share a trace or checkpoint.
      const ctx = buildRunContext({
        id: randomUUID(),
        organizationId: evalCase.context.organizationId,
        projectId: evalCase.context.projectId ?? null,
        agent,
        createdBy: evalCase.context.userId,
      });

      traceId = ctx.runId;
      const result = await executeRun(ctx, evalCase.input);
      output = result.output;
      traceId = result.traceId ?? ctx.runId;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - start;

    const scores = await Promise.all(scorers.map(async (scorer) => {
      try {
        return await scorer({ evalCase, output, error, durationMs });
      } catch (scorerError) {
        const reason = scorerError instanceof Error ? scorerError.message : String(scorerError);
        logger.warn({ caseId: evalCase.id, scorer: scorer.name, err: scorerError }, 'Eval scorer failed');
        return {
          name: scorer.name,
          passed: false,
          score: 0,
          reason: `Scorer failed: ${reason}`,
        };
      }
    }));

    const passed = scores.every((s) => s.passed);
    if (traceId) {
      for (const score of scores) {
        recordTraceScore(
          traceId,
          `eval:${score.name}`,
          score.score,
          score.reason,
          { caseId: evalCase.id, passed: score.passed },
        );
      }
      recordTraceScore(
        traceId,
        'eval:pass-rate',
        passed ? 1 : 0,
        passed ? 'All evaluation scorers passed' : 'One or more evaluation scorers failed',
        { caseId: evalCase.id, scorerCount: scores.length },
      );
    }

    results.push({
      caseId: evalCase.id,
      description: evalCase.description,
      passed,
      durationMs,
      output,
      error,
      scores,
    });

    logger.info(
      { caseId: evalCase.id, passed, durationMs },
      passed ? 'PASS' : 'FAIL',
    );
  }

  const passed = results.filter((r) => r.passed).length;

  return {
    agent,
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? passed / results.length : 0,
    cases: results,
  };
}
