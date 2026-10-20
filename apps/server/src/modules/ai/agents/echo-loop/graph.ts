// apps/server/src/modules/ai/agents/echo-loop/graph.ts
//
// Test agent that loops calling a READ tool to verify hard limits stop the run cleanly:
//   maxSteps, maxToolCalls, maxTokens

import { StateGraph, Annotation, END } from '@langchain/langgraph';
import type { RunContext } from '../../core/run-context.js';
import type { AgentRunOutput } from '../../core/types.js';
import { executeTool } from '../../tools/tool-factory.js';

const EchoLoopState = Annotation.Root({
  count: Annotation<number>({ default: () => 0, reducer: (a, b) => a + b }),
  output: Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
});

export function buildEchoLoopGraph(ctx: RunContext) {
  async function loopNode(state: typeof EchoLoopState.State): Promise<Partial<typeof EchoLoopState.State>> {
    const current = state.count + 1;
    await executeTool('fake_read_loop', { iteration: current }, ctx);
    return { count: 1 };
  }

  function shouldContinue(state: typeof EchoLoopState.State): 'loop' | typeof END {
    // Intentional infinite loop: runner must catch maxSteps / maxToolCalls
    if (state.count > 1000) return END;
    return 'loop';
  }

  const graph = new StateGraph(EchoLoopState)
    .addNode('loop', loopNode)
    .addEdge('__start__', 'loop')
    .addConditionalEdges('loop', shouldContinue, {
      loop: 'loop',
      [END]: END,
    });

  return graph;
}

export const ECHO_LOOP_AGENT_NAME = 'echo-loop' as const;
