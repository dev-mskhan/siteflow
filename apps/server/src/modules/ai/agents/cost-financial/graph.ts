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
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import type { BaseMessage } from '@langchain/core/messages';
import { createModel } from '../../graph/model-factory.js';
import { getAgent } from '../../core/agent-registry.js';
import { getToolsForAgent } from '../../tools/tool-registry.js';
import { executeTool } from '../../tools/tool-factory.js';
import {
  validateOutput,
  enforceNumberProvenance,
  enforceFigureProvenance,
} from '../../guardrails/output-guard.js';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ── State ─────────────────────────────────────────────────────────────────────

const CostFinancialState = Annotation.Root({
  messages:     Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  input:        Annotation<Record<string, unknown>>(),
  output:       Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
  toolCalls:    Annotation<number>({ default: () => 0, reducer: (a, b) => a + b }),
  toolResults:  Annotation<Array<Record<string, unknown>>>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
  toolNames:    Annotation<string[]>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
});

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildCostFinancialGraph(ctx: RunContext, acc: UsageAccumulator) {
  const toolDefs = getToolsForAgent(ALLOWED_TOOLS);
  const selectedProjectId =
    ctx.projectId ??
    (typeof ctx.input?.projectId === 'string' ? ctx.input.projectId : undefined);

  // Convert ToolDefinition[] → LangChain DynamicStructuredTool[] for ToolNode
  const langchainTools = toolDefs.map((def) =>
    tool(async (args: unknown) => {
      const scopedArgs =
        selectedProjectId && isRecord(args)
          ? { ...args, projectId: selectedProjectId }
          : args;
      const result = await executeTool(def.name, scopedArgs, ctx);
      if (!result.ok) return `Error: ${result.message}`;
      return JSON.stringify(result.data);
    }, {
      name: def.name,
      description: def.description,
      schema: def.argsSchema,
    }),
  );

  const manifest = getAgent(ctx.agent);
  if (!manifest) throw new Error(`Agent "${ctx.agent}" is not registered`);
  const model = createModel(manifest.tier, { accumulator: acc });
  if (!model.bindTools) throw new Error(`The model for "${ctx.agent}" does not support tool binding`);
  const modelWithTools = model.bindTools(langchainTools);

  // ── Nodes ──────────────────────────────────────────────────────────────────

  async function agentNode(
    state: typeof CostFinancialState.State,
  ): Promise<Partial<typeof CostFinancialState.State>> {
    // First call: prepend system + user message from input
    const messages: BaseMessage[] =
      state.messages.length === 0
        ? [
            new SystemMessage(
              selectedProjectId
                ? `${SYSTEM_PROMPT}\n\nAuthoritative selected project ID for this run: ${selectedProjectId}. Use only this project for project-scoped tools.`
                : SYSTEM_PROMPT,
            ),
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
    const parseAndValidate = (message: AIMessage): CostFinancialOutput => {
      if (typeof message.content !== 'string') {
        throw new Error('Agent response must be a JSON string');
      }

      const parsed: unknown = JSON.parse(message.content);
      const validated = validateOutput(parsed, costFinancialOutputSchema, 'cost-financial');
      enforceNumberProvenance(
        { answer: validated.answer, summary: validated.summary, citations: validated.citations },
        state.toolResults,
        'cost-financial',
      );

      enforceFigureProvenance(validated.answer.figures, state.toolResults, 'cost-financial');

      const citationsByTool = new Map<string, number>();
      for (const citation of validated.citations) {
        if (citation.snippet.trim()) {
          citationsByTool.set(
            citation.toolName,
            (citationsByTool.get(citation.toolName) ?? 0) + 1,
          );
        }
      }
      const uncitedTools = state.toolNames.filter((toolName) => {
        const citedCount = citationsByTool.get(toolName) ?? 0;
        if (citedCount > 0) {
          citationsByTool.set(toolName, citedCount - 1);
          return false;
        }
        return true;
      });
      if (uncitedTools.length > 0) {
        throw new Error(`Missing citations for tool calls: ${uncitedTools.join(', ')}`);
      }

      return validated;
    };

    let validated: CostFinancialOutput;
    try {
      validated = parseAndValidate(response);
    } catch (firstError) {
      const repairPrompt = new HumanMessage(
        `Your previous response did not satisfy the required cost-financial output contract: ${firstError instanceof Error ? firstError.message : String(firstError)}. ` +
          'Return only a JSON object with this shape: {"answer":{"narrative":"...","figures":[{"label":"Committed Costs","value":"15000.00","currency":"USD"}],"confidence":"HIGH","missingData":[]},"summary":"...","citations":[{"toolName":"exact tool name","snippet":"supporting excerpt from its result"}]}. ' +
          'Every figures entry must be an object with label, value, and optional currency; never use strings as figure entries. ' +
          'Do not include Markdown, tables, XML, or text outside the JSON. Do not invent or calculate figures. Cite every tool call.',
      );
      const repairedResponse = await model.invoke([...messages, response, repairPrompt]);

      try {
        validated = parseAndValidate(repairedResponse);
      } catch (repairError) {
        throw new Error(
          `Cost-financial response remained invalid after one repair attempt: ${repairError instanceof Error ? repairError.message : String(repairError)}`,
          { cause: repairError },
        );
      }

      return {
        messages: [response, repairPrompt, repairedResponse],
        output: {
          answer: validated.answer,
          summary: validated.summary,
          citations: validated.citations,
        },
        toolCalls: 0,
      };
    }

    return {
      messages: [response],
      output: {
        answer: validated.answer,
        summary: validated.summary,
        citations: validated.citations,
      },
    };
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

  const toolNode = new ToolNode(langchainTools);

  // Wrap tool node to capture results for provenance checking
  async function toolNodeWithCapture(
    state: typeof CostFinancialState.State,
  ): Promise<Partial<typeof CostFinancialState.State>> {
    // Execute tools via LangChain's ToolNode
    const toolOutput = await toolNode.invoke(state, {});
    
    // Extract tool results from the messages added by ToolNode
    const newMessages = toolOutput.messages ?? [];
    const toolResults: Array<Record<string, unknown>> = [];
    const toolNames: string[] = [];
    
    for (const msg of newMessages) {
      if (msg instanceof ToolMessage && msg.content) {
        if (msg.name) toolNames.push(msg.name);
        const content =
          typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        try {
          const parsed = JSON.parse(content);
          toolResults.push(parsed);
        } catch {
          // If tool returned non-JSON (e.g., error string), wrap it
          toolResults.push({ raw: content });
        }
      }
    }
    
    return { ...toolOutput, toolResults, toolNames };
  }

  // ── Graph ──────────────────────────────────────────────────────────────────

  return new StateGraph(CostFinancialState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNodeWithCapture)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
    .addEdge('tools', 'agent');
}
