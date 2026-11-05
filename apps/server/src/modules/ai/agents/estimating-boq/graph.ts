// apps/server/src/modules/ai/agents/estimating-boq/graph.ts
//
// Estimating-BOQ agent — extracts draft BOQ lines from spec documents,
// maps to cost codes, validates structure. READ-only. Never submits or approves.
//
// NO tracing setup — runner.ts wires buildTraceHandle + attachRunTraceHandle.

import { StateGraph, Annotation, END, messagesStateReducer } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import type { BaseMessage } from '@langchain/core/messages';
import { createModel } from '../../graph/model-factory.js';
import { getAgent } from '../../core/agent-registry.js';
import { getToolsForAgent } from '../../tools/tool-registry.js';
import { executeTool } from '../../tools/tool-factory.js';
import { validateOutput, enforceNumberProvenance, enforceFigureProvenance } from '../../guardrails/output-guard.js';
import { estimatingBoqOutputSchema, type EstimatingBoqOutput } from './output.schema.js';
import { SYSTEM_PROMPT, PROMPT_VERSION } from './prompts.js';
import type { RunContext } from '../../core/run-context.js';
import type { UsageAccumulator } from '../../cost/usage.service.js';
import type { AgentRunOutput } from '../../core/types.js';

const ALLOWED_TOOLS = [
  'read_okf_page',
  'list_boqs',
  'get_boq_revision',
  'list_estimates',
  'get_estimate',
  'list_takeoff_sheets',
  'get_takeoff_measurements',
  'get_takeoff_summary',
  'list_cost_codes',
  'search_knowledge_base',
];

// ── State ─────────────────────────────────────────────────────────────────────

const EstimatingBoqState = Annotation.Root({
  messages:     Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  input:        Annotation<Record<string, unknown>>(),
  output:       Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
  toolCalls:    Annotation<number>({ default: () => 0, reducer: (a, b) => a + b }),
  toolResults:  Annotation<Array<Record<string, unknown>>>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
  toolNames:    Annotation<string[]>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
  promptVersion: Annotation<string>({ default: () => PROMPT_VERSION, reducer: (_, b) => b }),
});

// ── Validate draft lines ───────────────────────────────────────────────────────

function validateDraftLines(
  draft: EstimatingBoqOutput['draft'],
  agentName: string,
): EstimatingBoqOutput['validationIssues'] {
  const issues: EstimatingBoqOutput['validationIssues'] = [];

  const seen = new Map<string, number>();
  for (let i = 0; i < draft.length; i++) {
    const line = draft[i]!;
    const key = line.description.trim().toLowerCase();

    // Duplicate check
    if (seen.has(key)) {
      issues.push({ lineIndex: i, issue: `Duplicate description: "${line.description}"`, severity: 'WARNING' });
    } else {
      seen.set(key, i);
    }

    // Zero/negative quantity
    const qty = parseFloat(line.quantity);
    if (isNaN(qty) || qty <= 0) {
      issues.push({ lineIndex: i, issue: `Invalid quantity "${line.quantity}" — must be positive`, severity: 'ERROR' });
    }

    // Unrecognised unit (allow common construction units)
    const KNOWN_UNITS = new Set([
      'm', 'm2', 'm3', 'mm', 'km', 'cm',
      'kg', 't', 'g', 'l', 'ml',
      'ea', 'no', 'nr', 'set', 'lot', 'item',
      'hr', 'day', 'wk', 'month',
      'lm', 'sm', 'cu',
    ]);
    if (!KNOWN_UNITS.has(line.unit.toLowerCase())) {
      issues.push({ lineIndex: i, issue: `Unrecognised unit "${line.unit}" — verify with spec`, severity: 'WARNING' });
    }
  }

  return issues;
}

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildEstimatingBoqGraph(ctx: RunContext, acc: UsageAccumulator) {
  const toolDefs = getToolsForAgent(ALLOWED_TOOLS);
  const selectedProjectId =
    ctx.projectId ??
    (typeof ctx.input?.projectId === 'string' ? ctx.input.projectId : undefined);

  const langchainTools = toolDefs.map((def) =>
    tool(async (args: unknown) => {
      const scopedArgs =
        selectedProjectId && args !== null && typeof args === 'object' && !Array.isArray(args)
          ? { ...args, projectId: (args as Record<string, unknown>).projectId ?? selectedProjectId }
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

  // ── Agent node ─────────────────────────────────────────────────────────────

  async function agentNode(
    state: typeof EstimatingBoqState.State,
  ): Promise<Partial<typeof EstimatingBoqState.State>> {
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

    if (response.tool_calls && response.tool_calls.length > 0) {
      return { messages: [response], toolCalls: response.tool_calls.length };
    }

    const parseAndValidate = (message: AIMessage): EstimatingBoqOutput => {
      if (typeof message.content !== 'string') {
        throw new Error('Agent response must be a JSON string');
      }
      const trimmed = message.content.trim();
      const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
      const parsed: unknown = JSON.parse(fenced?.[1] ?? trimmed);
      const validated = validateOutput(parsed, estimatingBoqOutputSchema, 'estimating-boq');

      enforceNumberProvenance(
        { answer: validated.answer, summary: validated.summary, citations: validated.citations },
        state.toolResults,
        'estimating-boq',
      );
      enforceFigureProvenance(validated.answer.figures, state.toolResults, 'estimating-boq');

      // Validate draft lines and inject issues
      const issues = validateDraftLines(validated.draft, 'estimating-boq');
      if (issues.length > 0) {
        validated.validationIssues = [...(validated.validationIssues ?? []), ...issues];
      }

      // Verify citations (skip read_okf_page)
      const citationsByTool = new Map<string, number>();
      for (const c of validated.citations) {
        if (c.snippet.trim()) {
          citationsByTool.set(c.toolName, (citationsByTool.get(c.toolName) ?? 0) + 1);
        }
      }
      const uncited = state.toolNames.filter((name) => {
        if (name === 'read_okf_page') return false;
        const count = citationsByTool.get(name) ?? 0;
        if (count > 0) { citationsByTool.set(name, count - 1); return false; }
        return true;
      });
      if (uncited.length > 0) {
        throw new Error(`Missing citations for tool calls: ${uncited.join(', ')}`);
      }

      return validated;
    };

    try {
      const validated = parseAndValidate(response);
      return {
        messages: [response],
        output: { answer: validated.answer, summary: validated.summary, citations: validated.citations },
      };
    } catch (firstError) {
      const repairPrompt = new HumanMessage(
        `Your previous response did not satisfy the estimating-boq output contract: ${firstError instanceof Error ? firstError.message : String(firstError)}. ` +
          'Return only valid JSON: {"answer":{"narrative":"...","figures":[],"confidence":"HIGH","missingData":[]},"draft":[],"validationIssues":[],"summary":"...","citations":[{"toolName":"exact name","snippet":"excerpt"}]}. ' +
          'Every draft line needs a source with toolName, resultPath, and snippet. No invented quantities. No Markdown outside JSON.',
      );
      const repaired = await model.invoke([...messages, response, repairPrompt]);
      try {
        const validated = parseAndValidate(repaired);
        return {
          messages: [response, repairPrompt, repaired],
          output: { answer: validated.answer, summary: validated.summary, citations: validated.citations },
          toolCalls: 0,
        };
      } catch (repairError) {
        throw new Error(
          `Estimating-BOQ response invalid after repair: ${repairError instanceof Error ? repairError.message : String(repairError)}`,
          { cause: repairError },
        );
      }
    }
  }

  function shouldContinue(state: typeof EstimatingBoqState.State): 'tools' | typeof END {
    const last = state.messages[state.messages.length - 1];
    if (last instanceof AIMessage && last.tool_calls && last.tool_calls.length > 0) return 'tools';
    return END;
  }

  const toolNode = new ToolNode(langchainTools);

  async function toolNodeWithCapture(
    state: typeof EstimatingBoqState.State,
  ): Promise<Partial<typeof EstimatingBoqState.State>> {
    const toolOutput = await toolNode.invoke(state, {});
    const newMessages = (toolOutput as any).messages ?? [];
    const toolResults: Array<Record<string, unknown>> = [];
    const toolNames: string[] = [];
    for (const msg of newMessages) {
      if (msg instanceof ToolMessage && msg.content) {
        if (msg.name) toolNames.push(msg.name);
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        try { toolResults.push(JSON.parse(content)); }
        catch { toolResults.push({ raw: content }); }
      }
    }
    return { ...toolOutput, toolResults, toolNames };
  }

  return new StateGraph(EstimatingBoqState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNodeWithCapture)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
    .addEdge('tools', 'agent');
}
