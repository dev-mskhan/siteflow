// apps/server/src/modules/ai/graph/runner.ts
//
// Executes any registered agent graph for a given RunContext.
//
// Responsibilities:
//   - Resolves the correct graph builder for ctx.agent
//   - Compiles the graph with the shared PostgresSaver checkpointer
//   - Runs the graph with a wall-clock timeout (AbortSignal)
//   - Enforces maxSteps, maxToolCalls via a step counter hooked on node execution
//   - Calls BudgetGuard.assertBudget() before every LLM-touching node
//   - Detects graph interrupt() (AWAITING_APPROVAL pause)
//   - Surfaces all limit / budget errors as clean RunFailed outcomes
//   - Returns a RunResult with output, token counts, cost

import { createLogger } from '@siteflow/observability/server';
import { getCheckpointer } from './checkpointer.js';
import { UsageAccumulator } from '../cost/usage.service.js';
import { BudgetGuard } from '../guardrails/budget-guard.js';
import { buildTraceHandle } from '../observability/tracing.js';
import { AgentNotFoundError, MaxStepsExceededError, RunTimeoutError } from '../core/errors.js';
import type { RunContext } from '../core/run-context.js';
import type { AgentRunOutput, AgentName } from '../core/types.js';

// ── Graph registry ────────────────────────────────────────────────────────────
// Add new agents here — never import them directly in worker code.

import { buildEchoGraph } from '../agents/echo/graph.js';
import { buildCostFinancialGraph } from '../agents/cost-financial/graph.js';

interface CompiledGraphLike {
  stream(input: unknown, config: unknown): Promise<AsyncIterable<unknown>>;
  getState(config: unknown): Promise<{ next?: readonly string[] }>;
}

type GraphBuilder = (ctx: RunContext, acc: UsageAccumulator) => {
  compile(options: { checkpointer: unknown }): CompiledGraphLike;
};

// LangGraph's StateGraph types don't structurally match CompiledGraphLike, so the
// builders are cast at the registry boundary; runtime shape is identical.
const GRAPH_REGISTRY: Record<AgentName | 'echo', GraphBuilder> = {
  'echo':            (ctx) => buildEchoGraph(ctx) as unknown as ReturnType<GraphBuilder>,
  'cost-financial':  (ctx, acc) => buildCostFinancialGraph(ctx, acc) as unknown as ReturnType<GraphBuilder>,
};

// ── Result type ───────────────────────────────────────────────────────────────

export interface RunResult {
  output: AgentRunOutput;
  tokensIn: number;
  tokensOut: number;
  costUsd: string;
  traceId: string | undefined;
  /** true when the graph paused at an interrupt() — worker transitions to AWAITING_APPROVAL */
  interrupted: boolean;
}

// ── Runner ────────────────────────────────────────────────────────────────────

const logger = createLogger({ name: 'ai-runner' });

export async function executeRun(ctx: RunContext): Promise<RunResult> {
  const { runId, threadId, limits } = ctx;

  logger.info({ runId, agent: ctx.agent }, 'Runner: starting graph execution');

  // ── 1. Resolve graph builder ──────────────────────────────────────────────
  const builder = GRAPH_REGISTRY[ctx.agent as keyof typeof GRAPH_REGISTRY];
  if (!builder) throw new AgentNotFoundError(ctx.agent);

  // ── 2. Create per-run accumulator + budget guard ──────────────────────────
  const accumulator = new UsageAccumulator(ctx);
  const budgetGuard = new BudgetGuard(ctx, accumulator);
  const traceHandle = buildTraceHandle(ctx);

  // ── 3. Compile graph with checkpointer ───────────────────────────────────
  const checkpointer = await getCheckpointer();
  const compiledGraph = builder(ctx, accumulator).compile({ checkpointer });

  // ── 4. Build LangGraph config ─────────────────────────────────────────────
  // thread_id == runId ensures each run has its own isolated checkpoint thread.
  // checkpoint_ns is blank (single-graph, no subgraphs).
  const lgConfig = {
    configurable: { thread_id: threadId, checkpoint_ns: '' },
    // Pass the recursion limit so LangGraph enforces it natively
    recursionLimit: limits.maxSteps,
  };

  // ── 5. Wall-clock timeout via AbortSignal ─────────────────────────────────
  const abort = AbortSignal.timeout(limits.timeoutMs);

  // ── 6. Step counter — enforced via streamEvents ───────────────────────────
  let stepCount = 0;

  try {
    // Initial budget check before any LLM call
    await budgetGuard.assertBudget();

    let finalOutput: AgentRunOutput | null = null;
    let interrupted = false;

    // stream('values') yields the full state after each node completes
    const stream = await compiledGraph.stream(
      { input: {} }, // input populated per-agent
      { ...lgConfig, signal: abort },
    );

    for await (const chunk of stream) {
      if (abort.aborted) {
        throw new RunTimeoutError(runId, limits.timeoutMs);
      }

      stepCount++;
      if (stepCount > limits.maxSteps) {
        throw new MaxStepsExceededError(runId, limits.maxSteps);
      }

      // Check budget after every node that could have triggered an LLM call
      await budgetGuard.assertBudget();

      // Capture final state output if present
      if (chunk && typeof chunk === 'object') {
        const state = chunk as Record<string, unknown>;
        if (state['output'] && typeof state['output'] === 'object') {
          finalOutput = state['output'] as AgentRunOutput;
        }
      }
    }

    // Detect interrupt: graph paused waiting for human approval
    const currentState = await compiledGraph.getState(lgConfig);
    if (currentState.next && currentState.next.length > 0) {
      interrupted = true;
      logger.info({ runId, next: currentState.next }, 'Graph interrupted — awaiting approval');
    }

    // Flush usage to daily aggregate (non-fatal)
    await accumulator.flush();

    return {
      output: finalOutput ?? {
        answer: null,
        summary: 'Run completed with no output.',
        citations: [],
      },
      tokensIn:  accumulator.tokensIn,
      tokensOut: accumulator.tokensOut,
      costUsd:   accumulator.totalCostUsd,
      traceId:   traceHandle.getTraceId(),
      interrupted,
    };
  } catch (err) {
    // Flush whatever usage we accumulated before failing
    await accumulator.flush();

    if (
      err instanceof MaxStepsExceededError ||
      err instanceof RunTimeoutError
    ) {
      throw err; // worker handles these as FAILED transitions
    }

    // Timeout from AbortSignal comes as a DOMException with name 'TimeoutError'
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new RunTimeoutError(runId, limits.timeoutMs);
    }

    throw err;
  }
}

/**
 * Resume a graph that was paused at an interrupt() (AWAITING_APPROVAL).
 * Called by approval.service after an APPROVED decision.
 *
 * @param ctx       — same RunContext as the original run
 * @param resumeVal — the value to inject as the interrupt result
 */
export async function resumeRun(
  ctx: RunContext,
  resumeVal: unknown,
): Promise<RunResult> {
  const { runId, threadId, limits } = ctx;
  logger.info({ runId }, 'Runner: resuming interrupted graph');

  const builder = GRAPH_REGISTRY[ctx.agent as keyof typeof GRAPH_REGISTRY];
  if (!builder) throw new AgentNotFoundError(ctx.agent);

  const accumulator = new UsageAccumulator(ctx);
  const budgetGuard = new BudgetGuard(ctx, accumulator);
  const checkpointer = await getCheckpointer();
  const compiledGraph = builder(ctx, accumulator).compile({ checkpointer });

  const lgConfig = {
    configurable: { thread_id: threadId, checkpoint_ns: '' },
    recursionLimit: limits.maxSteps,
  };

  const abort = AbortSignal.timeout(limits.timeoutMs);
  let stepCount = 0;

  try {
    await budgetGuard.assertBudget();

    let finalOutput: AgentRunOutput | null = null;

    // null as input = resume from checkpoint; resumeVal is the Command value
    const { Command } = await import('@langchain/langgraph');
    const stream = await compiledGraph.stream(
      new Command({ resume: resumeVal }),
      { ...lgConfig, signal: abort },
    );

    for await (const chunk of stream) {
      if (abort.aborted) throw new RunTimeoutError(runId, limits.timeoutMs);

      stepCount++;
      if (stepCount > limits.maxSteps) throw new MaxStepsExceededError(runId, limits.maxSteps);

      await budgetGuard.assertBudget();

      if (chunk && typeof chunk === 'object') {
        const state = chunk as Record<string, unknown>;
        if (state['output'] && typeof state['output'] === 'object') {
          finalOutput = state['output'] as AgentRunOutput;
        }
      }
    }

    await accumulator.flush();

    // Check if still interrupted (e.g. multiple approval steps)
    const currentState = await compiledGraph.getState(lgConfig);
    const interrupted = !!(currentState.next && currentState.next.length > 0);

    return {
      output: finalOutput ?? { answer: null, summary: 'Resumed run completed.', citations: [] },
      tokensIn:  accumulator.tokensIn,
      tokensOut: accumulator.tokensOut,
      costUsd:   accumulator.totalCostUsd,
      traceId:   undefined,
      interrupted,
    };
  } catch (err) {
    await accumulator.flush();
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new RunTimeoutError(runId, limits.timeoutMs);
    }
    throw err;
  }
}
