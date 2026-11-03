import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import { attachRunTraceHandle } from '../../../src/modules/ai/core/run-context.js';
import { UsageAccumulator } from '../../../src/modules/ai/cost/usage.service.js';
import { createModel } from '../../../src/modules/ai/graph/model-factory.js';
import { buildTraceHandle } from '../../../src/modules/ai/observability/tracing.js';
import { sanitizeLangfuseContent } from '../../../src/modules/ai/observability/content-policy.js';
import { HumanMessage } from '@langchain/core/messages';
import { serverEnv } from '../../../src/config/env.js';

const mocks = vi.hoisted(() => {
  const generation = { end: vi.fn() };
  const span = { end: vi.fn() };
  const trace = {
    generation: vi.fn(() => generation),
    span: vi.fn(() => span),
    score: vi.fn(),
    update: vi.fn(),
  };
  const client = { trace: vi.fn(() => trace) };
  return { generation, span, trace, client };
});

vi.mock('../../../src/modules/ai/observability/langfuse-client.js', () => ({
  getLangfuseClient: () => mocks.client,
}));

describe('Langfuse agent tracing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a run trace with request context and nested generation, tool, and score observations', () => {
    const ctx = buildRunContext({
      id: 'run-langfuse-01',
      organizationId: 'org-langfuse',
      projectId: 'project-langfuse',
      agent: 'cost-financial',
      createdBy: 'user-langfuse',
      inputSnapshot: { conversationId: 'conversation-01' },
    });

    const handle = buildTraceHandle(ctx, {
      question: 'Review the budget for owner@example.com',
    });

    expect(mocks.client.trace).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'run-langfuse-01',
        name: 'agent:cost-financial',
        input: { question: 'Review the budget for [REDACTED_EMAIL]' },
        sessionId: 'conversation-01',
        environment: 'test',
        version: '1.0.0',
      }),
    );

    const generation = handle.startGeneration('llm:gemini-3.5-flash', {
      messages: [{ role: 'user', content: 'Review the budget' }],
    });
    generation.end({ text: 'Budget summary' }, {
      inputTokens: 100,
      outputTokens: 25,
      inputCostUsd: '0.000000',
      outputCostUsd: '0.000000',
      totalCostUsd: '0.000000',
      costSource: 'configured-zero-cost-local-proxy',
      usageSource: 'provider-reported',
    });

    const tool = handle.startSpan('tool:get_cost_summary', { projectId: 'project-langfuse' });
    tool.end({ status: 'SUCCESS', result: { committed: '15000.00' } });
    handle.score('eval:citation-coverage', 1, 'All tools were cited');
    handle.end({ summary: 'Budget summary' });

    expect(mocks.trace.generation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'llm:gemini-3.5-flash' }),
    );
    expect(mocks.generation.end).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: { input: 100, output: 25, total: 125 },
        usageDetails: { input: 100, output: 25, total: 125 },
        costDetails: { input: 0, output: 0, total: 0 },
      }),
    );
    expect(mocks.trace.span).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'tool:get_cost_summary' }),
    );
    expect(mocks.span.end).toHaveBeenCalledWith(
      expect.objectContaining({ output: { status: 'SUCCESS', result: { committed: '15000.00' } } }),
    );
    expect(mocks.trace.score).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'eval:citation-coverage', value: 1 }),
    );
    expect(mocks.trace.update).toHaveBeenCalledWith(
      expect.objectContaining({ output: { summary: 'Budget summary' } }),
    );
  });

  it('redacts sensitive values from nested content in the default mode', () => {
    expect(sanitizeLangfuseContent({
      email: 'owner@example.com',
      nested: { accessToken: 'secret-value', projectName: 'North Tower' },
      prompt: 'Contact 415-555-0100',
    })).toEqual({
      email: '[REDACTED]',
      nested: { accessToken: '[REDACTED]', projectName: 'North Tower' },
      prompt: 'Contact [REDACTED_PHONE]',
    });
  });

  it('bounds deeply nested and oversized content', () => {
    let deeplyNested: unknown = 'value';
    for (let index = 0; index < 30; index += 1) {
      deeplyNested = { next: deeplyNested };
    }

    let current = sanitizeLangfuseContent(deeplyNested);
    let depth = 0;
    while (
      current !== '[TRUNCATED]' &&
      typeof current === 'object' &&
      current !== null &&
      'next' in current
    ) {
      current = current.next;
      depth += 1;
    }
    expect(current).toBe('[TRUNCATED]');
    expect(depth).toBeLessThanOrEqual(20);

    const oversized = sanitizeLangfuseContent(Array.from({ length: 10_100 }, (_, index) => index));
    expect(oversized).toHaveLength(10_000);
    expect(oversized).toContain('[TRUNCATED]');
  });

  it('records actual model calls and token/cost usage from the model callback', async () => {
    const originalProvider = serverEnv.AI_PROVIDER;
    (serverEnv as { AI_PROVIDER: typeof serverEnv.AI_PROVIDER }).AI_PROVIDER = 'fake';
    try {
      const baseContext = buildRunContext({
        id: 'run-langfuse-model-01',
        organizationId: 'org-langfuse',
        agent: 'echo',
        createdBy: 'user-langfuse',
      });
      const ctx = attachRunTraceHandle(baseContext, buildTraceHandle(baseContext));
      const accumulator = new UsageAccumulator(ctx);
      const model = createModel('cheap', { accumulator });
      await model.invoke([new HumanMessage('Count tokens for this request')]);

      expect(accumulator.calls).toHaveLength(1);
      expect(mocks.trace.generation).toHaveBeenCalled();
      expect(mocks.generation.end).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: expect.objectContaining({ input: expect.any(Number), output: expect.any(Number) }),
          costDetails: expect.objectContaining({ total: expect.any(Number) }),
        }),
      );
    } finally {
      (serverEnv as { AI_PROVIDER: typeof serverEnv.AI_PROVIDER }).AI_PROVIDER = originalProvider;
    }
  });
});
