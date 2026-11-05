// apps/server/src/modules/ai/agents/reports/graph.ts
//
// Reports Agent — Generates project and portfolio reports
// Tools: Wrap existing reporting services (7 report types)
// Model: cheap tier (sufficient for report generation)

import { StateGraph, Annotation, END, messagesStateReducer } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { BaseMessage } from '@langchain/core/messages';
import { createModel } from '../../graph/model-factory.js';
import { getAgent } from '../../core/agent-registry.js';
import { validateOutput } from '../../guardrails/output-guard.js';
import { reportsOutputSchema, type ReportsOutput } from './output.schema.js';
import { SYSTEM_PROMPT } from './prompts.js';
import type { RunContext } from '../../core/run-context.js';
import type { UsageAccumulator } from '../../cost/usage.service.js';
import type { AgentRunOutput } from '../../core/types.js';
import { reportService } from '../../../reporting/report.service.js';

// ── State ─────────────────────────────────────────────────────────────────────

const ReportsState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  input: Annotation<Record<string, unknown>>(),
  output: Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
  toolCalls: Annotation<number>({ default: () => 0, reducer: (a, b) => a + b }),
  toolResults: Annotation<Array<Record<string, unknown>>>({
    default: () => [],
    reducer: (a, b) => [...a, ...b],
  }),
  toolNames: Annotation<string[]>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
});

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildReportsGraph(ctx: RunContext, acc: UsageAccumulator) {
  const selectedProjectId = ctx.projectId ?? 
    (typeof ctx.input?.projectId === 'string' ? ctx.input.projectId : undefined);

  // ── Tools (wrapping existing report services) ─────────────────────────────

  const getHealthReportTool = tool(
    async (args: { projectId?: string }): Promise<string> => {
      const projectId = args.projectId ?? selectedProjectId;
      if (!projectId) {
        return JSON.stringify({ error: 'projectId is required for health report' });
      }

      try {
        const result = await reportService.getHealthReport(ctx.organizationId, projectId);
        if (!result) {
          return JSON.stringify({ error: 'Health report not found' });
        }
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({ error: (error as Error).message });
      }
    },
    {
      name: 'get_health_report',
      description: 'Get project health report with schedule/budget health, task stats, issues, RFIs, safety events',
      schema: z.object({
        projectId: z.string().uuid().optional().describe('Project ID (uses context projectId if omitted)'),
      }),
    },
  );

  const getScheduleReportTool = tool(
    async (args: { projectId?: string; filters?: unknown }): Promise<string> => {
      const projectId = args.projectId ?? selectedProjectId;
      if (!projectId) {
        return JSON.stringify({ error: 'projectId is required for schedule report' });
      }

      try {
        const result = await reportService.getScheduleReport(
          ctx.organizationId,
          projectId,
          args.filters,
        );
        if (!result) {
          return JSON.stringify({ error: 'Schedule report not found' });
        }
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({ error: (error as Error).message });
      }
    },
    {
      name: 'get_schedule_report',
      description: 'Get schedule variance report with SPI, baseline comparison, milestones, and task stats',
      schema: z.object({
        projectId: z.string().uuid().optional().describe('Project ID (uses context projectId if omitted)'),
        filters: z.record(z.unknown()).optional().describe('Optional filters (dateRange, etc.)'),
      }),
    },
  );

  const getCostReportTool = tool(
    async (args: { projectId?: string; filters?: unknown }): Promise<string> => {
      const projectId = args.projectId ?? selectedProjectId;
      if (!projectId) {
        return JSON.stringify({ error: 'projectId is required for cost report' });
      }

      try {
        const result = await reportService.getCostReport(
          ctx.organizationId,
          projectId,
          args.filters,
        );
        if (!result) {
          return JSON.stringify({ error: 'Cost report not found' });
        }
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({ error: (error as Error).message });
      }
    },
    {
      name: 'get_cost_report',
      description: 'Get cost report with budget vs actual, variance, CPI, and cost breakdown by currency',
      schema: z.object({
        projectId: z.string().uuid().optional().describe('Project ID (uses context projectId if omitted)'),
        filters: z.record(z.unknown()).optional().describe('Optional filters (dateRange, costCodes, etc.)'),
      }),
    },
  );

  const getProcurementReportTool = tool(
    async (args: { projectId?: string; filters?: unknown }): Promise<string> => {
      const projectId = args.projectId ?? selectedProjectId;
      if (!projectId) {
        return JSON.stringify({ error: 'projectId is required for procurement report' });
      }

      try {
        const result = await reportService.getProcurementReport(
          ctx.organizationId,
          projectId,
          args.filters,
        );
        if (!result) {
          return JSON.stringify({ error: 'Procurement report not found' });
        }
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({ error: (error as Error).message });
      }
    },
    {
      name: 'get_procurement_report',
      description: 'Get procurement report with material requests, POs, deliveries, receipts, and inventory stats',
      schema: z.object({
        projectId: z.string().uuid().optional().describe('Project ID (uses context projectId if omitted)'),
        filters: z.record(z.unknown()).optional().describe('Optional filters'),
      }),
    },
  );

  const getSubcontractorReportTool = tool(
    async (args: { projectId?: string; filters?: unknown }): Promise<string> => {
      const projectId = args.projectId ?? selectedProjectId;
      if (!projectId) {
        return JSON.stringify({ error: 'projectId is required for subcontractor report' });
      }

      try {
        const result = await reportService.getSubcontractorReport(
          ctx.organizationId,
          projectId,
          args.filters,
        );
        if (!result) {
          return JSON.stringify({ error: 'Subcontractor report not found' });
        }
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({ error: (error as Error).message });
      }
    },
    {
      name: 'get_subcontractor_report',
      description: 'Get subcontractor performance report with task completion, delays, and on-time rates per subcontractor',
      schema: z.object({
        projectId: z.string().uuid().optional().describe('Project ID (uses context projectId if omitted)'),
        filters: z.record(z.unknown()).optional().describe('Optional filters'),
      }),
    },
  );

  const getExecutiveSummaryTool = tool(
    async (args: { projectId?: string; filters?: unknown }): Promise<string> => {
      const projectId = args.projectId ?? selectedProjectId;
      if (!projectId) {
        return JSON.stringify({ error: 'projectId is required for executive summary' });
      }

      try {
        const result = await reportService.getExecutiveSummaryReport(
          ctx.organizationId,
          projectId,
          args.filters,
        );
        if (!result) {
          return JSON.stringify({ error: 'Executive summary not found' });
        }
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({ error: (error as Error).message });
      }
    },
    {
      name: 'get_executive_summary',
      description: 'Get comprehensive executive summary combining health, schedule, cost, and procurement reports',
      schema: z.object({
        projectId: z.string().uuid().optional().describe('Project ID (uses context projectId if omitted)'),
        filters: z.record(z.unknown()).optional().describe('Optional filters'),
      }),
    },
  );

  const getPortfolioReportTool = tool(
    async (): Promise<string> => {
      try {
        // Portfolio report needs actor with organizationMembership
        const actor = {
          userId: ctx.userId,
          organizationMembership: {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            // Add other required fields as needed
          },
        };

        const result = await reportService.getPortfolioReport(
          ctx.organizationId,
          actor,
          undefined, // No filters
        );
        if (!result) {
          return JSON.stringify({ error: 'Portfolio report not found' });
        }
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({ error: (error as Error).message });
      }
    },
    {
      name: 'get_portfolio_report',
      description: 'Get organization-wide portfolio report showing all projects with health indicators. Does NOT need projectId.',
      schema: z.object({}),
    },
  );

  const langchainTools = [
    getHealthReportTool,
    getScheduleReportTool,
    getCostReportTool,
    getProcurementReportTool,
    getSubcontractorReportTool,
    getExecutiveSummaryTool,
    getPortfolioReportTool,
  ];

  const manifest = getAgent(ctx.agent);
  if (!manifest) throw new Error(`Agent "${ctx.agent}" is not registered`);

  const model = createModel('cheap', { accumulator: acc });
  if (!model.bindTools) {
    throw new Error(`The model for "${ctx.agent}" does not support tool binding`);
  }
  const modelWithTools = model.bindTools(langchainTools);

  // ── Nodes ─────────────────────────────────────────────────────────────────

  async function agentNode(
    state: typeof ReportsState.State,
  ): Promise<Partial<typeof ReportsState.State>> {
    const messages: BaseMessage[] =
      state.messages.length === 0
        ? [
            new SystemMessage(
              selectedProjectId
                ? `${SYSTEM_PROMPT}\n\nContext projectId: ${selectedProjectId}. Use this for project reports unless user specifies otherwise.`
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

    // Check if agent wants to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      return {
        messages: [response],
        toolCalls: response.tool_calls.length,
      };
    }

    // Agent is done — extract and validate output
    const content =
      typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // If not JSON, wrap in error object
      parsed = {
        reportType: 'Error',
        asOf: new Date().toISOString(),
        summary: 'Could not parse agent response',
        keyFindings: ['Response was not valid JSON'],
        insights: content.substring(0, 500),
        reportData: { error: 'Invalid response format' },
        citations: [],
      };
    }

    // Validate output schema
    const validation = reportsOutputSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error(`Invalid reports output: ${validation.error.message}`);
    }

    const output: AgentRunOutput = {
      answer: validation.data,
      summary: validation.data.summary,
      citations: validation.data.citations.map((c) => ({
        toolName: c.toolName,
        snippet: c.section,
      })),
    };

    return {
      messages: [response],
      output,
    };
  }

  const toolNode = new ToolNode(langchainTools);

  async function callTools(
    state: typeof ReportsState.State,
  ): Promise<Partial<typeof ReportsState.State>> {
    const result = await toolNode.invoke(state);
    return {
      messages: result.messages,
    };
  }

  function shouldContinue(state: typeof ReportsState.State): typeof END | 'tools' {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return END;

    const aiMsg = lastMessage as AIMessage;
    if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
      return 'tools';
    }

    return END;
  }

  // ── Graph ─────────────────────────────────────────────────────────────────

  const workflow = new StateGraph(ReportsState)
    .addNode('agent', agentNode)
    .addNode('tools', callTools)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent');

  return workflow.compile();
}
