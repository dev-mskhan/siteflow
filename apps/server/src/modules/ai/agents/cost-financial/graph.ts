// apps/server/src/modules/ai/agents/cost-financial/graph.ts
//
// Read-only cost & financial analysis agent.
// Tools: get_financial_summary, get_cost_summary, get_billing_summary,
//        get_cash_summary, get_budget, get_budget_summary, list_financial_audit_events
// All tools are READ tier — no writes, no BINDING calls, no approvals needed.
//
// Graph shape:
//   __start__ → agent (reason + pick tools) → tools → agent → ... → __end__
//   Standard ReAct loop with a hard recursion limit enforced by the runner.

import { StateGraph, Annotation, END, messagesStateReducer } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { createModel } from '../../graph/model-factory.js';
import { getToolsForAgent } from '../../tools/tool-registry.js';
import { executeTool } from '../../tools/tool-factory.js';
import { validateOutput } from '../../guardrails/output-guard.js';
import { costFinancialOutputSchema, type CostFinancialOutput } from './output.schema.js';
import { SYSTEM_PROMPT } from './prompts.js';
import type { RunContext } from '../../core/run-context.js';
import type { UsageAccumulator } from '../../cost/usage.service.js';
import type { AgentRunOutput } from '../../core/types.js';

// ── Allowed tools for this agent ──────────────────────────────────────────────
const ALLOWED_TOOLS = [
  'get_financial_summary',
  'get_cost_summary',
  'get_billing_summary',
  'get_cash_summary',
  'get_budget',
  'get_budget_summary',
  'list_financial_audit_events',
];

// ── State ─────────────────────────────────────────────────────────────────────

const CostFinancialState = Annotation.Root({
  messages:  Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  input:     Annotation<Record<string, unknown>>(),
  output:    Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
  toolCalls: Annotation<number>({ default: () => 0, reducer: (a, b) => a + b }),
});

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildCostFinancialGraph(ctx: RunContext, acc: UsageAccumulator) {
  const toolDefs = getToolsForAgent(ALLOWED_TOOLS);

  // Convert ToolDefinition[] → LangChain DynamicStructuredTool[] for ToolNode
  const langchainTools = toolDefs.map((def) => ({
    name: def.name,
    description: def.description,
    schema: def.argsSchema,
    func: async (args: unknown) => {
      const result = await executeTool(def.name, args, ctx);
      if (!result.ok) return `Error: ${result.message}`;
      return JSON.stringify(result.data);
    },
  }));

  // Model bound with tools — "cheap" tier for multi-step reasoning
  const model = createModel('cheap', { accumulator: acc });
  const modelWithTools = typeof (model as any).bindTools === 'function'
    ? (model as any).bindTools(langchainTools)
    : model;

  // ── Nodes ──────────────────────────────────────────────────────────────────

  async function agentNode(
    state: typeof CostFinancialState.State,
  ): Promise<Partial<typeof CostFinancialState.State>> {
    // First call: prepend system + user message from input
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

    // Check if the LLM wants to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      return { messages: [response], toolCalls: response.tool_calls.length };
    }

    // No tool calls → LLM has the final answer; parse and validate output
    let finalOutput: AgentRunOutput;
    try {
      const parsed = JSON.parse(response.content as string) as CostFinancialOutput;
      const validated = validateOutput(parsed, costFinancialOutputSchema, 'cost-financial');
      finalOutput = {
        answer: validated.answer,
        summary: validated.summary,
        citations: validated.citations,
      };
    } catch {
      // LLM returned plain text instead of JSON — wrap it gracefully
      finalOutput = {
        answer: { narrative: response.content as string, figures: [] },
        summary: (response.content as string).slice(0, 200),
        citations: [],
      };
    }

    return { messages: [response], output: finalOutput };
  }

  function shouldContinue(
    state: typeof CostFinancialState.State,
  ): 'tools' | typeof END {
    const last = state.messages[state.messages.length - 1];
    if (last instanceof AIMessage && last.tool_calls && last.tool_calls.length > 0) {
      return 'tools';
    }
    return END;
  }

  const toolNode = new ToolNode(langchainTools as any);

  // ── Graph ──────────────────────────────────────────────────────────────────

  return new StateGraph(CostFinancialState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
    .addEdge('tools', 'agent');
}
