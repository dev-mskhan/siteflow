// apps/server/src/modules/ai/agents/echo-slow/graph.ts
//
// Test agent that calls fake_sleep to verify timeout and cooperative cancellation.

import { StateGraph, Annotation, END } from '@langchain/langgraph';
import type { RunContext } from '../../core/run-context.js';
import type { AgentRunOutput } from '../../core/types.js';
import { executeTool } from '../../tools/tool-factory.js';

const EchoSlowState = Annotation.Root({
  output: Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
});

export function buildEchoSlowGraph(ctx: RunContext) {
  async function slowNode(): Promise<Partial<typeof EchoSlowState.State>> {
    // Sleeps longer than the default timeout unless cancelled
    await executeTool('fake_sleep', { durationMs: ctx.limits.timeoutMs + 2000 }, ctx);
    const output: AgentRunOutput = {
      answer: { completed: true },
      summary: 'Completed slow operation.',
      citations: [],
    };
    return { output };
  }

  const graph = new StateGraph(EchoSlowState)
    .addNode('slow', slowNode)
    .addEdge('__start__', 'slow')
    .addEdge('slow', END);

  return graph;
}

export const ECHO_SLOW_AGENT_NAME = 'echo-slow' as const;
