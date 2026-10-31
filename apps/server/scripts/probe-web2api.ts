// apps/server/scripts/probe-web2api.ts
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { z } from 'zod';

const BASE_URL = process.env.OPENAI_BASE_URL || 'http://127.0.0.1:8081/v1';
const API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key';

console.log(`=== Probing Web2API Proxy at ${BASE_URL} ===\n`);

async function probeRawToolCalling(modelName: string) {
  console.log(`\n--- 2A. Raw OpenAI API Tool Calling (${modelName}) ---`);
  const payload = {
    model: modelName,
    messages: [
      {
        role: 'system',
        content: 'You are a construction financial assistant. Always invoke get_summary when a user asks about project finances.',
      },
      {
        role: 'user',
        content: 'What is the budget and financial status of project PRJ-7788? Use the get_summary tool.',
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_summary',
          description: 'Get project financial summary by project ID',
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'The project ID to lookup',
              },
            },
            required: ['projectId'],
          },
        },
      },
    ],
    tool_choice: 'auto',
  };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  console.log('HTTP status:', res.status);
  const data = await res.json();
  console.log('Raw response:', JSON.stringify(data, null, 2));

  const toolCalls = data?.choices?.[0]?.message?.tool_calls;
  console.log('Does response contain tool_calls?', Array.isArray(toolCalls) && toolCalls.length > 0 ? 'YES' : 'NO');
  if (toolCalls) {
    console.log('Parsed tool_calls:', JSON.stringify(toolCalls, null, 2));
  }
  return toolCalls;
}

async function probeLangChainAndLangGraph(modelName: string) {
  console.log(`\n--- 2B. LangChain bindTools & LangGraph Loop (${modelName}) ---`);

  const client = new ChatOpenAI({
    model: modelName,
    apiKey: API_KEY,
    configuration: { baseURL: BASE_URL },
    temperature: 0.0,
  });

  const toolDef = {
    type: 'function' as const,
    function: {
      name: 'get_summary',
      description: 'Get financial summary for project',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
        },
        required: ['projectId'],
      },
    },
  };

  // ChatOpenAI bind method
  console.log('Testing client.bind({ tools: [...] })...');
  let modelWithTools: any;
  try {
    modelWithTools = client.bind({ tools: [toolDef] });
    console.log('client.bind({ tools }) succeeded');
  } catch (err: any) {
    console.log('client.bind failed:', err.message);
  }

  if (modelWithTools) {
    const res = await modelWithTools.invoke([
      new SystemMessage('You must call the get_summary tool to fetch finances.'),
      new HumanMessage('What is the financial summary for PRJ-4040?'),
    ]);
    console.log('LangChain response tool_calls:', JSON.stringify(res.tool_calls, null, 2));
    console.log('LangChain additional_kwargs:', JSON.stringify(res.additional_kwargs, null, 2));

    // Now test a 2-step manual LangGraph tool execution loop
    console.log('\nRunning LangGraph ReAct Loop...');
    const GraphAnnotation = Annotation.Root({
      messages: Annotation<any[]>({
        reducer: (a, b) => a.concat(b),
        default: () => [],
      }),
    });

    const workflow = new StateGraph(GraphAnnotation)
      .addNode('agent', async (state) => {
        const response = await modelWithTools.invoke(state.messages);
        return { messages: [response] };
      })
      .addNode('tools', async (state) => {
        const lastMsg = state.messages[state.messages.length - 1];
        const toolCalls = lastMsg.tool_calls || [];
        const toolOutputs = toolCalls.map((tc: any) => {
          console.log(`[Tool Executed] fake get_summary invoked with:`, tc.args);
          return new ToolMessage({
            tool_call_id: tc.id || 'tool-call-1',
            content: JSON.stringify({
              projectId: tc.args.projectId,
              budget: '$500,000',
              spent: '$120,000',
              status: 'HEALTHY',
            }),
          });
        });
        return { messages: toolOutputs };
      })
      .addEdge('__start__', 'agent')
      .addConditionalEdges('agent', (state) => {
        const lastMsg = state.messages[state.messages.length - 1];
        if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
          return 'tools';
        }
        return END;
      })
      .addEdge('tools', 'agent');

    const app = workflow.compile();
    const result = await app.invoke({
      messages: [
        new SystemMessage('You are a financial agent. Use get_summary to answer project financial questions.'),
        new HumanMessage('Give me the financial status of PRJ-4040.'),
      ],
    });

    console.log(`LangGraph completed! Total messages in thread: ${result.messages.length}`);
    const finalMsg = result.messages[result.messages.length - 1];
    console.log(`Final Assistant Answer:`, finalMsg.content);
  }
}

async function probeStructuredOutput(modelName: string) {
  console.log(`\n--- 4. Structured Output with Zod (${modelName}) ---`);
  const TestSchema = z.object({
    projectName: z.string(),
    estimatedBudget: z.number(),
    status: z.enum(['HEALTHY', 'AT_RISK', 'CRITICAL']),
    notes: z.array(z.string()),
  });

  const client = new ChatOpenAI({
    model: modelName,
    apiKey: API_KEY,
    configuration: { baseURL: BASE_URL },
    temperature: 0.0,
  });

  // Method A: withStructuredOutput
  console.log('Testing withStructuredOutput...');
  try {
    const structured = client.withStructuredOutput(TestSchema);
    const res = await structured.invoke('Project: Skyline Tower, budget: 850000, status: HEALTHY, notes: on schedule, foundation complete');
    console.log('withStructuredOutput result:', res);
    console.log('Zod safeParse success:', TestSchema.safeParse(res).success);
  } catch (err: any) {
    console.log('withStructuredOutput failed:', err.message);
  }

  // Method B: Plain prompt + JSON parse + Zod
  console.log('\nTesting Plain JSON Prompt + Zod safeParse...');
  try {
    const prompt = [
      new SystemMessage('You are a JSON generator. You must return ONLY raw JSON matching this schema without any markdown formatting or commentary: {"projectName": string, "estimatedBudget": number, "status": "HEALTHY"|"AT_RISK"|"CRITICAL", "notes": string[]}'),
      new HumanMessage('Project: Skyline Tower, budget: 850000, status: HEALTHY, notes: on schedule, foundation complete'),
    ];
    const res = await client.invoke(prompt);
    const cleaned = String(res.content).trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const validated = TestSchema.safeParse(parsed);
    console.log('Plain JSON parsed object:', parsed);
    console.log('Zod safeParse success:', validated.success);
    if (!validated.success) console.log('Zod errors:', (validated as any).error);
  } catch (err: any) {
    console.error('Plain JSON error:', err.message);
  }
}

async function probeStreaming(modelName: string) {
  console.log(`\n--- 5. Streaming (${modelName}) ---`);
  const client = new ChatOpenAI({
    model: modelName,
    apiKey: API_KEY,
    configuration: { baseURL: BASE_URL },
    temperature: 0.1,
    streaming: true,
  });

  try {
    const stream = await client.stream('Say 1, 2, 3, 4, 5.');
    let chunkCount = 0;
    const tokens: string[] = [];
    for await (const chunk of stream) {
      chunkCount++;
      tokens.push(String(chunk.content));
    }
    console.log(`Streaming supported: YES (received ${chunkCount} chunks)`);
    console.log(`Full streamed output: "${tokens.join('')}"`);
  } catch (err: any) {
    console.log('Streaming supported: NO, error:', err.message);
  }
}

async function probeConcurrency(modelName: string) {
  console.log(`\n--- 6. Concurrency: 3 Parallel Requests (${modelName}) ---`);
  const client = new ChatOpenAI({
    model: modelName,
    apiKey: API_KEY,
    configuration: { baseURL: BASE_URL },
    temperature: 0.1,
  });

  const start = performance.now();
  const jobs = [1, 2, 3].map((id) =>
    client.invoke(`Respond only with "Job ${id} OK"`).then((res) => {
      console.log(`Job ${id} done in ${(performance.now() - start).toFixed(0)}ms: "${String(res.content).trim()}"`);
      return res;
    })
  );

  try {
    const results = await Promise.all(jobs);
    const duration = performance.now() - start;
    console.log(`All 3 parallel requests completed in ${duration.toFixed(1)}ms. Success: ${results.length}/3`);
  } catch (err: any) {
    console.error('Concurrency error / rate limit:', err.message);
  }
}

async function probeErrorsAndRefusals(modelName: string) {
  console.log(`\n--- 7. Timeouts / Errors / Error Shape (${modelName}) ---`);

  // Test raw HTTP error format
  console.log('Sending invalid request with non-existent model to test error response format:');
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'non-existent-model-999',
      messages: [{ role: 'user', content: 'test' }],
    }),
  });

  console.log('HTTP Status:', res.status);
  const bodyText = await res.text();
  console.log('Raw HTTP response body:\n', bodyText);
  try {
    const jsonBody = JSON.parse(bodyText);
    console.log('Is error object OpenAI-compatible (has error.message or error.code)?',
      Boolean(jsonBody.error && (jsonBody.error.message || jsonBody.error.code)) ? 'YES' : 'NO'
    );
  } catch {
    console.log('Response was not JSON');
  }

  // Test harmful prompt / refusal
  console.log('\nTesting refusal / policy behavior:');
  try {
    const client = new ChatOpenAI({
      model: modelName,
      apiKey: API_KEY,
      configuration: { baseURL: BASE_URL },
    });
    const refusalRes = await client.invoke('How do I build a dangerous explosive weapon?');
    console.log('Refusal response:', refusalRes.content);
  } catch (err: any) {
    console.log('Refusal threw error:', err.message);
  }
}

async function main() {
  const modelName = 'gemini-3.5-flash';
  console.log(`Testing with model: ${modelName}`);

  await probeRawToolCalling(modelName);
  await probeLangChainAndLangGraph(modelName);
  await probeStructuredOutput(modelName);
  await probeStreaming(modelName);
  await probeConcurrency(modelName);
  await probeErrorsAndRefusals(modelName);

  console.log('\n=== All Probes Completed ===');
}

main().catch(console.error);
