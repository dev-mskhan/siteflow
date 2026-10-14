// apps/server/src/modules/ai/agents/echo/graph.ts
//
// Echo agent — the simplest possible LangGraph to prove the full pipeline:
//   build RunContext → create model → budget-guard → run graph →
//   checkpoint pause/resume → write outcome.
//
// It does NOT call an LLM. It simply copies the run's inputSnapshot into
// the output, records one fake token count, and finishes.
// Use this in smoke tests and to validate the worker/runner/checkpointer chain.

import { StateGraph, Annotation, END } from '@langchain/langgraph';
import type { RunContext } from '../../core/run-context.js';
import type { AgentRunOutput } from '../../core/types.js';

// ── State ─────────────────────────────────────────────────────────────────────

const EchoState = Annotation.Root({
  input:  Annotation<Record<string, unknown>>(),
  output: Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
});

// ── Nodes ─────────────────────────────────────────────────────────────────────

function echoNode(state: typeof EchoState.State): Partial<typeof EchoState.State> {
  const output: AgentRunOutput = {
    answer:   state.input,
    summary:  'Echo agent: input reflected back as output.',
    citations: [],
  };
  return { output };
}

// ── Graph ─────────────────────────────────────────────────────────────────────

export function buildEchoGraph(_ctx: RunContext) {
  const graph = new StateGraph(EchoState)
    .addNode('echo', echoNode)
    .addEdge('__start__', 'echo')
    .addEdge('echo', END);

  // Checkpointer is injected by runner.ts at compile time — not here
  return graph;
}

export const ECHO_AGENT_NAME = 'echo' as const;
