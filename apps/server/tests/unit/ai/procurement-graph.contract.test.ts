import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import { buildProcurementGraph } from '../../../src/modules/ai/agents/procurement/graph.js';
import { UsageAccumulator } from '../../../src/modules/ai/cost/usage.service.js';
import { setModelOverride } from '../../../src/modules/ai/graph/model-factory.js';
import { ScriptedFakeChatModel } from '../../helpers/ai/fake-model.js';

const mocks = vi.hoisted(() => ({
  getToolsForAgent: vi.fn(),
  executeTool: vi.fn(),
}));

vi.mock('../../../src/modules/ai/tools/tool-registry.js', () => ({
  getToolsForAgent: mocks.getToolsForAgent,
}));

vi.mock('../../../src/modules/ai/tools/tool-factory.js', () => ({
  executeTool: mocks.executeTool,
}));

describe('procurement graph contract', () => {
  afterEach(() => {
    setModelOverride(null);
    vi.clearAllMocks();
  });

  it('forces project-scoped tool calls to use the trusted run project', async () => {
    const trustedProjectId = 'c0a80123-4567-4890-8123-456789abcdef';
    const modelProjectId = 'c0a80123-4567-4890-8123-456789abcdee';
    const toolName = 'list_purchase_orders';
    mocks.getToolsForAgent.mockReturnValue([{
      name: toolName,
      description: 'List purchase orders.',
      argsSchema: z.object({ projectId: z.string().uuid() }),
    }]);
    mocks.executeTool.mockResolvedValue({
      ok: true,
      data: { purchaseOrders: [{ id: 'po-1', total: '15000.00' }] },
    });

    const model = new ScriptedFakeChatModel([
      { toolCalls: [{ name: toolName, args: { projectId: modelProjectId } }] },
      JSON.stringify({
        answer: {
          narrative: 'One purchase order is available.',
          figures: [{ label: 'PO total', value: '15000.00', currency: 'USD' }],
        },
        summary: 'One purchase order is available.',
        citations: [{ toolName, snippet: 'purchaseOrders contains one result' }],
      }),
    ]);
    setModelOverride(() => model);

    const ctx = buildRunContext({
      id: 'run-procurement-contract',
      organizationId: 'org-procurement-contract',
      projectId: trustedProjectId,
      agent: 'procurement',
      createdBy: 'user-procurement-contract',
    });
    const graph = buildProcurementGraph(ctx, new UsageAccumulator(ctx)).compile();
    const result = await graph.invoke({ input: { question: 'List purchase orders' } });

    expect(mocks.executeTool).toHaveBeenCalledWith(
      toolName,
      { projectId: trustedProjectId },
      ctx,
    );
    expect(result.output).toMatchObject({
      summary: 'One purchase order is available.',
      citations: [{ toolName }],
    });
  });

  it('fails invalid model output instead of returning a success-shaped text wrapper', async () => {
    mocks.getToolsForAgent.mockReturnValue([]);
    setModelOverride(() => new ScriptedFakeChatModel([
      'Here is the procurement answer.',
      'Still not JSON.',
    ]));

    const ctx = buildRunContext({
      id: 'run-procurement-invalid-output',
      organizationId: 'org-procurement-contract',
      agent: 'procurement',
      createdBy: 'user-procurement-contract',
    });
    const graph = buildProcurementGraph(ctx, new UsageAccumulator(ctx)).compile();

    await expect(graph.invoke({ input: { question: 'Summarize procurement' } }))
      .rejects.toThrow('Procurement response remained invalid after one repair attempt');
  });

  it('accepts valid JSON wrapped in a Markdown code fence', async () => {
    mocks.getToolsForAgent.mockReturnValue([]);
    const output = JSON.stringify({
      answer: {
        narrative: 'No purchase order data is available.',
        figures: [],
        confidence: 'INSUFFICIENT_DATA',
        missingData: ['Purchase order data'],
      },
      summary: 'No purchase order data is available.',
      citations: [],
    });
    setModelOverride(() => new ScriptedFakeChatModel([`\`\`\`json\n${output}\n\`\`\``]));

    const ctx = buildRunContext({
      id: 'run-procurement-fenced-json',
      organizationId: 'org-procurement-contract',
      agent: 'procurement',
      createdBy: 'user-procurement-contract',
    });
    const graph = buildProcurementGraph(ctx, new UsageAccumulator(ctx)).compile();
    const result = await graph.invoke({ input: { question: 'Summarize procurement' } });

    expect(result.output).toMatchObject({
      summary: 'No purchase order data is available.',
      answer: { confidence: 'INSUFFICIENT_DATA' },
    });
  });

  it('normalizes sourced string figures into the output contract', async () => {
    const toolName = 'get_procurement_report';
    const projectId = 'c0a80123-4567-4890-8123-456789abcdef';
    mocks.getToolsForAgent.mockReturnValue([{
      name: toolName,
      description: 'Get the procurement report.',
      argsSchema: z.object({ projectId: z.string().uuid() }),
    }]);
    mocks.executeTool.mockResolvedValue({
      ok: true,
      data: { purchaseOrdersByStatus: { APPROVED: 2 }, committed: '15000.00' },
    });
    setModelOverride(() => new ScriptedFakeChatModel([
      { toolCalls: [{ name: toolName, args: { projectId } }] },
      JSON.stringify({
        answer: {
          narrative: 'Two approved orders are listed.',
          figures: ['Approved POs: 2', 'Committed: $15,000.00'],
          confidence: 'HIGH',
          missingData: [],
        },
        summary: 'Two approved orders are listed.',
        citations: [{ toolName, snippet: 'APPROVED: 2' }],
      }),
    ]));

    const ctx = buildRunContext({
      id: 'run-procurement-string-figure',
      organizationId: 'org-procurement-contract',
      agent: 'procurement',
      createdBy: 'user-procurement-contract',
      inputSnapshot: { projectId },
    });
    const graph = buildProcurementGraph(ctx, new UsageAccumulator(ctx)).compile();
    const result = await graph.invoke({ input: { question: 'Summarize orders' } });

    expect(result.output).toMatchObject({
      answer: {
        figures: [
          { label: 'Approved POs', value: '2' },
          { label: 'Committed', value: '15000.00' },
        ],
      },
    });
  });

  it('marks an answer insufficient when every procurement tool fails', async () => {
    const toolName = 'get_procurement_report';
    mocks.getToolsForAgent.mockReturnValue([{
      name: toolName,
      description: 'Get the procurement report.',
      argsSchema: z.object({ projectId: z.string().uuid() }),
    }]);
    mocks.executeTool.mockResolvedValue({
      ok: false,
      code: 'TOOL_PERMISSION_DENIED',
      message: 'Missing permission',
    });
    const fencedAnswer = (confidence: 'HIGH' | 'INSUFFICIENT_DATA') =>
      `\`\`\`json\n${JSON.stringify({
        answer: {
          narrative: 'The procurement report could not be retrieved.',
          figures: [],
          confidence,
          missingData: [],
        },
        summary: 'The procurement report could not be retrieved.',
        citations: [{ toolName, snippet: 'Error: Missing permission' }],
      })}\n\`\`\``;
    setModelOverride(() => new ScriptedFakeChatModel([
      { toolCalls: [{ name: toolName, args: { projectId: 'c0a80123-4567-4890-8123-456789abcdef' } }] },
      fencedAnswer('HIGH'),
    ]));

    const ctx = buildRunContext({
      id: 'run-procurement-tool-errors',
      organizationId: 'org-procurement-contract',
      agent: 'procurement',
      createdBy: 'user-procurement-contract',
      inputSnapshot: { projectId: 'c0a80123-4567-4890-8123-456789abcdef' },
    });
    const graph = buildProcurementGraph(ctx, new UsageAccumulator(ctx)).compile();
    const result = await graph.invoke({ input: { question: 'Summarize procurement' } });

    expect(result.output).toMatchObject({
      answer: {
        confidence: 'INSUFFICIENT_DATA',
        missingData: ['Procurement data could not be retrieved from the available tools.'],
      },
    });
  });

  it('rejects numeric figures not present in the tool results', async () => {
    mocks.getToolsForAgent.mockReturnValue([]);
    const invalidOutput = JSON.stringify({
      answer: {
        narrative: 'The total is 999.00 USD.',
        figures: [{ label: 'Total', value: '999.00', currency: 'USD' }],
      },
      summary: 'Total 999.00 USD',
      citations: [],
    });
    setModelOverride(() => new ScriptedFakeChatModel([invalidOutput, invalidOutput]));

    const ctx = buildRunContext({
      id: 'run-procurement-provenance',
      organizationId: 'org-procurement-contract',
      agent: 'procurement',
      createdBy: 'user-procurement-contract',
    });
    const graph = buildProcurementGraph(ctx, new UsageAccumulator(ctx)).compile();

    await expect(graph.invoke({ input: { question: 'What is the total?' } }))
      .rejects.toThrow('Figure provenance violation in agent "procurement"');
  });
});
