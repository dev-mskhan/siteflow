// apps/server/src/modules/ai/evals/scorers/index.ts
// Built-in scorers usable across all agents.

import type { Scorer, ScorerInput, ScorerResult } from '../harness.js';

/** Passes if the run produced no error */
export const noErrorScorer: Scorer = ({ error }: ScorerInput): ScorerResult => ({
  name: 'no-error',
  passed: error === null,
  score: error === null ? 1 : 0,
  reason: error ?? 'Run completed without error',
});

/** Passes if the output matches the expected schema (basic truthy check) */
export const hasOutputScorer: Scorer = ({ output }: ScorerInput): ScorerResult => ({
  name: 'has-output',
  passed: output !== null && output.answer !== null,
  score: output !== null && output.answer !== null ? 1 : 0,
  reason: output ? 'Output present' : 'No output produced',
});

/** Passes if the run completes within a given duration */
export function maxDurationScorer(maxMs: number): Scorer {
  return ({ durationMs }: ScorerInput): ScorerResult => ({
    name: `max-duration-${maxMs}ms`,
    passed: durationMs <= maxMs,
    score: Math.max(0, 1 - durationMs / maxMs),
    reason: `Completed in ${durationMs}ms (limit: ${maxMs}ms)`,
  });
}

/** Passes if the output summary contains all expected keywords */
export function keywordScorer(keywords: string[]): Scorer {
  return ({ output }: ScorerInput): ScorerResult => {
    const summary = output?.summary?.toLowerCase() ?? '';
    const found = keywords.filter((k) => summary.includes(k.toLowerCase()));
    const passed = found.length === keywords.length;
    return {
      name: 'keyword',
      passed,
      score: keywords.length > 0 ? found.length / keywords.length : 1,
      reason: passed
        ? `All keywords found: ${keywords.join(', ')}`
        : `Missing: ${keywords.filter((k) => !found.includes(k)).join(', ')}`,
    };
  };
}

/** Passes if the output answer contains a specific key */
export function answerKeyScorer(key: string): Scorer {
  return ({ output }: ScorerInput): ScorerResult => {
    const answer = output?.answer as Record<string, unknown> | null;
    const passed = answer !== null && key in (answer ?? {});
    return {
      name: `answer-key:${key}`,
      passed,
      score: passed ? 1 : 0,
      reason: passed ? `Key "${key}" present in answer` : `Key "${key}" missing from answer`,
    };
  };
}
