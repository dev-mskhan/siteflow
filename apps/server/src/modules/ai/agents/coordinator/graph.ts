// apps/server/src/modules/ai/agents/coordinator/graph.ts
//
// Coordinator Agent — Routes questions to specialized agents using a cheap model
// Model: gpt-4o-mini (cheap tier for classification)
// Tools: route_to_agent, list_available_agents
//
// Graph shape:
//   __start__ → agent (analyze + route) → tools → agent → __end__
//   Typically single-step: agent picks specialist, tool creates sub-run, agent formats response

import { StateGraph, Annotation, END, messagesStateReducer } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { BaseMessage } from '@langchain/core/messages';
import { createModel } from '../../graph/model-factory.js';
import { getAgent, listAgents } from '../../core/agent-registry.js';
import { validateOutput } from '../../guardrails/output-guard.js';
import { coordinatorOutputSchema, type CoordinatorOutput } from './output.schema.js';
import { SYSTEM_PROMPT } from './prompts.js';
import type { RunContext } from '../../core/run-context.js';
import type { UsageAccumulator } from '../../cost/usage.service.js';
import type { AgentRunOutput } from '../../core/types.js';
import { AgentRunService } from '../../runs/agent-run.service.js';
import type { AgentName } from '../../core/types.js';

// ── State ─────────────────────────────────────────────────────────────────────

const CoordinatorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  input: Annotation<Record<string, unknown>>(),
  output: Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
  toolCalls: Annotation<number>({ default: () => 0, reducer: (a, b) => a + b }),
  subRunResults: Annotation<Array<{ agent: string; runId: string; result: unknown }>>({
    default: () => [],
    reducer: (a, b) => [...a, ...b],
  }),
});

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildCoordinatorGraph(ctx: RunContext, acc: UsageAccumulator) {
  const runService = new AgentRunService();

  // ── Tools ─────────────────────────────────────────────────────────────────

  const routeToAgentTool = tool(
    async (args: { agent: string; question: string }): Promise<string> => {
      const { agent, question } = args;

      // Validate agent exists
      const manifest = getAgent(agent);
      if (!manifest) {
        return JSON.stringify({
          error: `Unknown agent: ${agent}. Available agents: ${listAgents().map((a) => a.name).join(', ')}`,
        });
      }

      // Check if agent supports API channel
      if (!manifest.supportedChannels.includes('api')) {
        return JSON.stringify({
          error: `Agent "${agent}" does not support API channel`,
        });
      }

      // Create sub-run with same context
      const { runId: subRunId } = await runService.startRun({
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        agent: agent as AgentName,
        trigger: 'AGENT', // Sub-run triggered by parent agent
        triggerRef: `coordinator:${ctx.agent}`, // Track coordinator as trigger source
        channel: 'api',
        conversationId: ctx.conversationId,
        parentRunId: ctx.runId, // Link to parent coordinator run
        correlationId: ctx.correlationId,
        input: { question }, // Pass question to specialist agent
        createdBy: ctx.userId,
      });

      // Wait for sub-run to complete (timeout after 5 minutes)
      const maxWaitMs = 5 * 60 * 1000;
      const pollIntervalMs = 2000; // Poll every 2 seconds
      const startTime = Date.now();

      let subRun = await runService.getRun(subRunId, ctx.organizationId);

      while (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(subRun.status)) {
        if (Date.now() - startTime > maxWaitMs) {
          return JSON.stringify({
            error: `Sub-run timeout after 5 minutes`,
            subRunId,
            status: subRun.status,
          });
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        subRun = await runService.getRun(subRunId, ctx.organizationId);
      }

      // Return sub-run result
      if (subRun.status === 'SUCCEEDED') {
        return JSON.stringify({
          success: true,
          subRunId,
          status: subRun.status,
          result: subRun.outputSnapshot,
        });
      } else {
        return JSON.stringify({
          success: false,
          subRunId,
          status: subRun.status,
          error: subRun.errorMessage ?? 'Sub-run failed',
        });
      }
    },
    {
      name: 'route_to_agent',
      description: 'Route the user question to a specialized agent and wait for the response',
      schema: z.object({
        agent: z.enum([
          'compliance',
          'estimating-boq',
          'cost-financial',
          'procurement',
          'reports',
        ]).describe('The specialized agent to route to'),
        question: z.string().describe('The question to ask the specialized agent'),
      }),
    },
  );

  const listAvailableAgentsTool = tool(
    async (): Promise<string> => {
      const agents = listAgents().filter(
        (a) =>
          a.supportedChannels.includes('api') &&
          !a.name.startsWith('echo') && // Exclude test agents
          a.name !== 'coordinator', // Exclude self
      );

      const agentInfo = agents.map((a) => ({
        name: a.name,
        version: a.version,
        capabilities: a.allowedTools,
      }));

      return JSON.stringify({ agents: agentInfo });
    },
    {
      name: 'list_available_agents',
      description: 'List all available specialized agents with their capabilities',
      schema: z.object({}),
    },
  );

  const langchainTools = [routeToAgentTool, listAvailableAgentsTool];

  const manifest = getAgent(ctx.agent);
  if (!manifest) throw new Error(`Agent "${ctx.agent}" is not registered`);

  // Use cheap model for coordinator (gpt-4o-mini)
  const model = createModel('cheap', { accumulator: acc });
  if (!model.bindTools) {
    throw new Error(`The model for "${ctx.agent}" does not support tool binding`);
  }
  const modelWithTools = model.bindTools(langchainTools);

  // ── Nodes ─────────────────────────────────────────────────────────────────

  async function agentNode(
    state: typeof CoordinatorState.State,
  ): Promise<Partial<typeof CoordinatorState.State>> {
    const messages: BaseMessage[] =
      state.messages.length === 0
        ? [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
              typeof state.input.question === 'string'
                ? state.input.question
                : JSON.stringify(state.input),
            ),
          ]
        : state.messages;

    const response = await modelWithTools.invoke(messages);

    // Check if agent wants to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      return {
        messages: [response],
        toolCalls: response.tool_calls.length,
      };
    }

    // Agent is done — extract and validate output
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    let parsed: unknown;
    try {
      // Try to parse as JSON
      parsed = JSON.parse(content);
    } catch {
      // If not JSON, wrap in object
      parsed = {
        routedTo: { agent: 'unknown', reason: 'Could not determine routing' },
        response: { summary: content, details: content },
        metadata: { subRunId: 'none', subRunStatus: 'FAILED', subRunError: 'No routing performed' },
      };
    }

    // Validate output schema
    const validation = coordinatorOutputSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error(`Invalid coordinator output: ${validation.error.message}`);
    }

    const output: AgentRunOutput = {
      answer: validation.data,
      summary: validation.data.response.summary,
    };

    return {
      messages: [response],
      output,
    };
  }

  const toolNode = new ToolNode(langchainTools);

  async function callTools(
    state: typeof CoordinatorState.State,
  ): Promise<Partial<typeof CoordinatorState.State>> {
    const result = await toolNode.invoke(state);
    return {
      messages: result.messages,
    };
  }

  function shouldContinue(state: typeof CoordinatorState.State): typeof END | 'tools' {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return END;

    const aiMsg = lastMessage as AIMessage;
    if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
      return 'tools';
    }

    return END;
  }

  // ── Graph ─────────────────────────────────────────────────────────────────

  const workflow = new StateGraph(CoordinatorState)
    .addNode('agent', agentNode)
    .addNode('tools', callTools)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent');

  return workflow.compile();
}
