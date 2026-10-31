import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { SystemMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { UsageAccumulator } from '../../../src/modules/ai/cost/usage.service.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import { createModel, setModelOverride } from '../../../src/modules/ai/graph/model-factory.js';
import { buildCostFinancialGraph } from '../../../src/modules/ai/agents/cost-financial/graph.js';

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

describe('cost-financial ChatOpenAI contract', () => {
  let server: Server | undefined;

  afterEach(async () => {
    setModelOverride(null);
    vi.clearAllMocks();
    if (server?.listening) {
      server.close();
      await once(server, 'close');
    }
    server = undefined;
  });

  it('binds tools and completes a full tool-result round trip via chat completions', async () => {
    const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
        requests.push({ path: request.url ?? '', body });
        const result = requests.length === 1
          ? {
              id: 'chatcmpl-tool',
              object: 'chat.completion',
              created: 1,
              model: 'stub-model',
              choices: [{
                index: 0,
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    id: 'call-financial-summary',
                    type: 'function',
                    function: { name: 'get_financial_summary', arguments: '{}' },
                  }],
                },
                finish_reason: 'tool_calls',
              }],
              usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
            }
          : {
              id: 'chatcmpl-final',
              object: 'chat.completion',
              created: 2,
              model: 'stub-model',
              choices: [{
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    answer: {
                      narrative: 'The total is 125 USD.',
                      figures: [{ label: 'Total', value: 125, currency: 'USD' }],
                    },
                    summary: 'Total 125 USD',
                    citations: [{ toolName: 'get_financial_summary', snippet: 'Total 125 USD' }],
                  }),
                },
                finish_reason: 'stop',
              }],
              usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
            };
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(result));
      });

    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Stub server failed to bind');

    mocks.getToolsForAgent.mockReturnValue([{
      name: 'get_financial_summary',
      description: 'Read the financial summary.',
      argsSchema: z.object({}),
      riskTier: 'READ',
      requiredPermission: 'project:read',
      execute: vi.fn(),
    }]);
    mocks.executeTool.mockResolvedValue({
      ok: true,
      data: { total: '125.00', currency: 'USD' },
    });

    let selectedTier: string | undefined;
    setModelOverride((tier) => {
      selectedTier = tier;
      return new ChatOpenAI({
        model: 'stub-model',
        apiKey: 'contract-test-key',
        configuration: { baseURL: `http://127.0.0.1:${address.port}/v1` },
        temperature: 0,
        maxRetries: 0,
      });
    });

    const ctx = buildRunContext({
      id: 'cost-financial-contract',
      organizationId: 'org-contract',
      agent: 'cost-financial',
      createdBy: 'user-contract',
    });
    const graph = buildCostFinancialGraph(ctx, new UsageAccumulator(ctx)).compile();
    const result = await graph.invoke({ input: { question: 'What is the total?' } });

    expect(selectedTier).toBe('cheap');
    expect(result.output).toMatchObject({
      answer: { figures: [{ label: 'Total', value: 125, currency: 'USD' }] },
      summary: 'Total 125 USD',
    });
    expect(requests).toHaveLength(2);
    expect(requests.map(({ path }) => path)).toEqual([
      '/v1/chat/completions',
      '/v1/chat/completions',
    ]);
    expect(requests[0]?.body).toHaveProperty('tools');
    expect(requests[0]?.body['tools']).toEqual(expect.arrayContaining([
      expect.objectContaining({
        function: expect.objectContaining({ name: 'get_financial_summary' }),
      }),
    ]));
    const secondMessages = requests[1]?.body['messages'] as Array<Record<string, unknown>>;
    expect(secondMessages.some((message) =>
      message['role'] === 'tool' &&
      String(message['content']).includes('"total":"125.00"'),
    )).toBe(true);
  });

  it.skipIf(process.env['AI_LIVE_SMOKE'] !== 'true')(
    'completes a live web2api tool-result round trip',
    async () => {
      const model = createModel('cheap');
      const readProbe = tool(async () => 'unused', {
        name: 'read_probe',
        description: 'Read the fixed round-trip probe value.',
        schema: z.object({}),
      });
      const modelWithTool = model.bindTools([readProbe]);
      if (!modelWithTool) throw new Error('Configured model does not support tool binding');

      const messages = [
        new SystemMessage(
          'Call read_probe exactly once. After its result, reply with only the status value.',
        ),
        new HumanMessage('Run the protocol check.'),
      ];
      const firstResponse = await modelWithTool.invoke(messages);
      const [call] = firstResponse.tool_calls ?? [];
      if (!call) throw new Error('Live model did not return the requested tool call');

      const finalResponse = await model.invoke([
        ...messages,
        firstResponse,
        new ToolMessage({
          content: JSON.stringify({ status: 'ROUND_TRIP_OK' }),
          tool_call_id: call.id,
        }),
      ]);
      expect(String(finalResponse.content)).toContain('ROUND_TRIP_OK');
    },
    60_000,
  );
});
