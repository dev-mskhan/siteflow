import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runEval } from '../../../src/modules/ai/evals/harness.js';

const mocks = vi.hoisted(() => ({
  executeRun: vi.fn(),
  recordTraceScore: vi.fn(),
}));

vi.mock('../../../src/modules/ai/graph/runner.js', () => ({
  executeRun: mocks.executeRun,
}));

vi.mock('../../../src/modules/ai/observability/tracing.js', () => ({
  recordTraceScore: mocks.recordTraceScore,
}));

describe('Langfuse evaluation scores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeRun.mockResolvedValue({
      output: { answer: { narrative: 'Summary' }, summary: 'Summary', citations: [] },
      traceId: 'trace-eval-001',
    });
  });

  it('publishes each scorer result and the overall pass score to its run trace', async () => {
    const summary = await runEval(
      'cost-financial',
      [{
        id: 'case-01',
        description: 'Basic output check',
        context: { organizationId: 'org-eval', userId: 'user-eval' },
        input: { question: 'Summarize costs' },
      }],
      [() => ({
        name: 'schema-valid',
        passed: true,
        score: 1,
        reason: 'Output matched the expected schema',
      })],
    );

    expect(summary.passRate).toBe(1);
    expect(mocks.recordTraceScore).toHaveBeenCalledWith(
      'trace-eval-001',
      'eval:schema-valid',
      1,
      'Output matched the expected schema',
      { caseId: 'case-01', passed: true },
    );
    expect(mocks.recordTraceScore).toHaveBeenCalledWith(
      'trace-eval-001',
      'eval:pass-rate',
      1,
      'All evaluation scorers passed',
      { caseId: 'case-01', scorerCount: 1 },
    );
  });

  it('counts a throwing scorer as a failed evaluation instead of aborting the batch', async () => {
    const failingScorer = () => {
      throw new Error('Evaluator unavailable');
    };
    const summary = await runEval(
      'procurement',
      [{
        id: 'case-02',
        description: 'Scorer error',
        context: { organizationId: 'org-eval', userId: 'user-eval' },
        input: { question: 'Check deliveries' },
      }],
      [failingScorer],
    );

    expect(summary.failed).toBe(1);
    expect(summary.cases[0]?.scores[0]).toMatchObject({
      name: 'failingScorer',
      passed: false,
      score: 0,
      reason: 'Scorer failed: Evaluator unavailable',
    });
  });
});
