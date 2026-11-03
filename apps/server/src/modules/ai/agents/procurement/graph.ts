// apps/server/src/modules/ai/agents/procurement/graph.ts
//
// Read-only procurement analysis agent.
// Tools: list_purchase_orders, get_purchase_order, list_quotes, get_quote,
//        compare_quotes, get_procurement_report, check_delivery_status
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
import { procurementOutputSchema, type ProcurementOutput } from './output.schema.js';
import { SYSTEM_PROMPT, PROMPT_VERSION } from './prompts.js';
import type { RunContext } from '../../core/run-context.js';
import type { UsageAccumulator } from '../../cost/usage.service.js';
import type { AgentRunOutput } from '../../core/types.js';

// ── Allowed tools for this agent ──────────────────────────────────────────────
const ALLOWED_TOOLS = [
  'list_purchase_orders',
  'get_purchase_order',
  'list_quotes',
  'get_quote',
  'compare_quotes',
  'get_procurement_report',
  'check_delivery_status',
];

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

function normalizeFigureStrings(
  output: unknown,
  toolResults: Array<Record<string, unknown>>,
): unknown {
  if (output === null || typeof output !== 'object' || Array.isArray(output)) return output;
  const answer = (output as Record<string, unknown>).answer;
  if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) return output;
  const figures = (answer as Record<string, unknown>).figures;
  if (!Array.isArray(figures) || !figures.some((figure) => typeof figure === 'string')) {
    return output;
  }

  const sourceValues = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === 'string' || typeof value === 'number') {
      sourceValues.add(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(collect);
    }
  };
  collect(toolResults);

  const normalizedFigures = figures.map((figure) => {
    if (typeof figure !== 'string') return figure;
    const text = figure.trim();
    const labeledValue = /^(.+?)\s*[:\u2013\u2014]\s*(.+)$/.exec(text);
    const rawValue = labeledValue?.[2]?.trim() ?? text;
    if (sourceValues.has(rawValue)) {
      return {
        label: labeledValue?.[1]?.trim() || 'Procurement detail',
        value: rawValue,
      };
    }
    const value = /^[$€£]?\s*-?\d[\d,]*(?:\.\d+)?$/.test(rawValue)
      ? rawValue.replace(/[$€£,\s]/g, '')
      : rawValue;
    const numericValues =
      value.match(/(?<![\w-])-?\d+(?:\.\d+)?(?![\w-])/g) ?? [];
    if (numericValues.some((numericValue) => !sourceValues.has(numericValue))) {
      throw new Error(`Figure provenance violation in agent "procurement": ${text}`);
    }
    return {
      label: labeledValue?.[1]?.trim() || 'Procurement detail',
      value,
    };
  });

  return {
    ...(output as Record<string, unknown>),
    answer: { ...(answer as Record<string, unknown>), figures: normalizedFigures },
  };
}

// ── State ─────────────────────────────────────────────────────────────────────

const ProcurementState = Annotation.Root({
  messages:     Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  input:        Annotation<Record<string, unknown>>(),
  output:       Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
  toolCalls:    Annotation<number>({ default: () => 0, reducer: (a, b) => a + b }),
  toolResults:  Annotation<Array<Record<string, unknown>>>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
  toolNames:    Annotation<string[]>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
  promptVersion: Annotation<string>({ default: () => PROMPT_VERSION, reducer: (_, b) => b }),
});

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildProcurementGraph(ctx: RunContext, acc: UsageAccumulator) {
  const toolDefs = getToolsForAgent(ALLOWED_TOOLS);
  const selectedProjectId =
    ctx.projectId ??
    (typeof ctx.input?.projectId === 'string' ? ctx.input.projectId : undefined);

  // Convert ToolDefinition[] → LangChain DynamicStructuredTool[] for ToolNode
  const langchainTools = toolDefs.map((def) =>
    tool(async (args: unknown) => {
      const scopedArgs =
        selectedProjectId && args !== null && typeof args === 'object' && !Array.isArray(args)
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
    state: typeof ProcurementState.State,
  ): Promise<Partial<typeof ProcurementState.State>> {
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

    const parseAndValidate = (message: AIMessage): ProcurementOutput => {
      if (typeof message.content !== 'string') {
        throw new Error('Agent response must be a JSON string');
      }

      const parsed = normalizeFigureStrings(
        parseJsonContent(message.content),
        state.toolResults,
      );
      const validated = validateOutput(parsed, procurementOutputSchema, 'procurement');
      enforceNumberProvenance(
        { answer: validated.answer, summary: validated.summary, citations: validated.citations },
        state.toolResults,
        'procurement',
      );
      enforceFigureProvenance(validated.answer.figures, state.toolResults, 'procurement');

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
      const toolErrors = state.toolResults.filter(
        (result) => typeof result.raw === 'string' && result.raw.startsWith('Error:'),
      );
      const successfulToolResults = state.toolResults.length - toolErrors.length;
      if (toolErrors.length > 0 && successfulToolResults === 0) {
        validated.answer.confidence = 'INSUFFICIENT_DATA';
        validated.answer.missingData = [
          ...new Set([
            ...(validated.answer.missingData ?? []),
            'Procurement data could not be retrieved from the available tools.',
          ]),
        ];
      }
      return validated;
    };

    try {
      const validated = parseAndValidate(response);
      return {
        messages: [response],
        output: {
          answer: validated.answer,
          summary: validated.summary,
          citations: validated.citations,
        },
      };
    } catch (firstError) {
      const repairPrompt = new HumanMessage(
        `Your previous response did not satisfy the procurement output contract: ${firstError instanceof Error ? firstError.message : String(firstError)}. ` +
          'Return only valid JSON with this shape: {"answer":{"narrative":"...","figures":[],"confidence":"HIGH","missingData":[]},"summary":"...","citations":[{"toolName":"exact tool name","snippet":"supporting excerpt from the tool result"}]}. ' +
          'Do not invent figures. Cite every tool call. Do not include Markdown or text outside the JSON.',
      );
      const repairedResponse = await model.invoke([...messages, response, repairPrompt]);

      try {
        const validated = parseAndValidate(repairedResponse);
        return {
          messages: [response, repairPrompt, repairedResponse],
          output: {
            answer: validated.answer,
            summary: validated.summary,
            citations: validated.citations,
          },
          toolCalls: 0,
        };
      } catch (repairError) {
        throw new Error(
          `Procurement response remained invalid after one repair attempt: ${repairError instanceof Error ? repairError.message : String(repairError)}`,
          { cause: repairError },
        );
      }
    }
  }

  function shouldContinue(
    state: typeof ProcurementState.State,
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
    state: typeof ProcurementState.State,
  ): Promise<Partial<typeof ProcurementState.State>> {
    // Execute tools via LangChain's ToolNode
    const toolOutput = await toolNode.invoke(state, {});
    
    // Extract tool results from the messages added by ToolNode
    const newMessages = (toolOutput as any).messages || [];
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

  return new StateGraph(ProcurementState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNodeWithCapture)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
    .addEdge('tools', 'agent');
}
