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
import { tool } from '@langchain/core/tools';
import type { BaseMessage } from '@langchain/core/messages';
import { createModel } from '../../graph/model-factory.js';
import { getAgent } from '../../core/agent-registry.js';
import { getToolsForAgent } from '../../tools/tool-registry.js';
import { executeTool } from '../../tools/tool-factory.js';
import { validateOutput, enforceNumberProvenance } from '../../guardrails/output-guard.js';
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
  messages:     Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  input:        Annotation<Record<string, unknown>>(),
  output:       Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
  toolCalls:    Annotation<number>({ default: () => 0, reducer: (a, b) => a + b }),
  toolResults:  Annotation<Array<Record<string, unknown>>>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
});

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildCostFinancialGraph(ctx: RunContext, acc: UsageAccumulator) {
  const toolDefs = getToolsForAgent(ALLOWED_TOOLS);

  // Convert ToolDefinition[] → LangChain DynamicStructuredTool[] for ToolNode
  const langchainTools = toolDefs.map((def) =>
    tool(async (args: unknown) => {
      const result = await executeTool(def.name, args, ctx);
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
    let repairAttempted = false;
    
    try {
      const parsed = JSON.parse(response.content as string) as CostFinancialOutput;
      const validated = validateOutput(parsed, costFinancialOutputSchema, 'cost-financial');
      
      // STRICT PROVENANCE ENFORCEMENT: All numbers must come from tool results
      enforceNumberProvenance(
        { answer: validated.answer, summary: validated.summary, citations: validated.citations },
        state.toolResults,
        'cost-financial',
      );
      
      finalOutput = {
        answer: validated.answer,
        summary: validated.summary,
        citations: validated.citations,
      };
    } catch (firstError) {
      // Check if this is a JSON syntax error (malformed JSON) vs plain text response
      const isJsonSyntaxError = firstError instanceof SyntaxError && 
        (response.content as string).trim().startsWith('{');
      
      // BOUNDED JSON REPAIR: One attempt to fix malformed JSON
      // Only attempt repair if it looks like an attempt at JSON (starts with {)
      if (!repairAttempted && isJsonSyntaxError) {
        repairAttempted = true;
        
        // Ask model to fix the JSON
        const repairPrompt = new HumanMessage(
          `Your previous response was not valid JSON. Please fix the syntax errors and return a valid JSON response that matches the required schema. ` +
          `The response must have this structure: { "answer": { "narrative": "...", "figures": [...], "confidence": "HIGH" }, "summary": "...", "citations": [...] }`
        );
        
        const repairedResponse = await modelWithTools.invoke([...messages, response, repairPrompt]);
        
        try {
          const parsed = JSON.parse(repairedResponse.content as string) as CostFinancialOutput;
          const validated = validateOutput(parsed, costFinancialOutputSchema, 'cost-financial');
          
          enforceNumberProvenance(
            { answer: validated.answer, summary: validated.summary, citations: validated.citations },
            state.toolResults,
            'cost-financial',
          );
          
          finalOutput = {
            answer: validated.answer,
            summary: validated.summary,
            citations: validated.citations,
          };
          
          // Repair succeeded - return with updated messages
          return { messages: [response, repairPrompt, repairedResponse], output: finalOutput, toolCalls: 0 };
        } catch (secondError) {
          // Repair failed - fall back to plain text wrapper
          finalOutput = {
            answer: { narrative: repairedResponse.content as string, figures: [] },
            summary: (repairedResponse.content as string).slice(0, 200),
            citations: [],
          };
          return { messages: [response, repairPrompt, repairedResponse], output: finalOutput, toolCalls: 0 };
        }
      }
      
      // Plain text response or repair already attempted - wrap as plain text
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

  const toolNode = new ToolNode(langchainTools);

  // Wrap tool node to capture results for provenance checking
  async function toolNodeWithCapture(
    state: typeof CostFinancialState.State,
  ): Promise<Partial<typeof CostFinancialState.State>> {
    // Execute tools via LangChain's ToolNode
    const toolOutput = await toolNode.invoke(state, {});
    
    // Extract tool results from the messages added by ToolNode
    const newMessages = (toolOutput as any).messages || [];
    const toolResults: Array<Record<string, unknown>> = [];
    
    for (const msg of newMessages) {
      if (msg.constructor.name === 'ToolMessage' && msg.content) {
        try {
          const parsed = JSON.parse(msg.content);
          toolResults.push(parsed);
        } catch {
          // If tool returned non-JSON (e.g., error string), wrap it
          toolResults.push({ raw: msg.content });
        }
      }
    }
    
    return { ...toolOutput, toolResults };
  }

  // ── Graph ──────────────────────────────────────────────────────────────────

  return new StateGraph(CostFinancialState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNodeWithCapture)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
    .addEdge('tools', 'agent');
}
