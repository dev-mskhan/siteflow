// apps/server/tests/unit/ai/fake-model.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import {
  ScriptedFakeChatModel,
  installScriptedModel,
  clearScriptedModel,
} from '../../helpers/ai/fake-model.js';
import { createModel } from '../../../src/modules/ai/graph/model-factory.js';
import { UsageAccumulator } from '../../../src/modules/ai/cost/usage.service.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';

describe('Scripted Fake LLM Model & Usage Accumulator Tracking', () => {
  const dummyCtx = buildRunContext({
    id: 'test-run-model-01',
    organizationId: 'org-01',
    agent: 'echo',
    createdBy: 'usr-01',
  });

  afterEach(() => {
    clearScriptedModel();
  });

  it('emits plain text responses in FIFO order', async () => {
    const fakeModel = new ScriptedFakeChatModel([
      'First simulated thought',
      'Second simulated thought',
    ]);

    const res1 = await fakeModel.invoke([new HumanMessage('Hello')]);
    expect(res1.content).toBe('First simulated thought');

    const res2 = await fakeModel.invoke([new HumanMessage('How are you?')]);
    expect(res2.content).toBe('Second simulated thought');
  });

  it('emits structured tool calls with correct arguments and call IDs', async () => {
    const fakeModel = new ScriptedFakeChatModel([
      {
        text: 'I will approve this action.',
        toolCalls: [
          {
            name: 'fake_approve_something',
            args: { amount: 250, action: 'order_steel' },
            id: 'call_steel_123',
          },
        ],
      },
    ]);

    const res = await fakeModel.invoke([new HumanMessage('Approve steel order')]);
    expect(res.content).toBe('I will approve this action.');
    expect(res.tool_calls).toBeDefined();
    expect(res.tool_calls!.length).toBe(1);
    expect(res.tool_calls![0].name).toBe('fake_approve_something');
    expect(res.tool_calls![0].args).toEqual({ amount: 250, action: 'order_steel' });
    expect(res.tool_calls![0].id).toBe('call_steel_123');
  });

  it('records token usage into UsageAccumulator via model callback hook', async () => {
    const accumulator = new UsageAccumulator(dummyCtx);

    installScriptedModel([
      {
        text: 'Analysis response',
        tokensIn: 120,
        tokensOut: 45,
      },
      {
        text: 'Final response',
        tokensIn: 80,
        tokensOut: 60,
      },
    ]);

    const model = createModel('cheap', { accumulator });
    await model.invoke([new HumanMessage('Step 1')]);

    expect(accumulator.tokensIn).toBe(120);
    expect(accumulator.tokensOut).toBe(45);
    expect(accumulator.calls.length).toBe(1);

    await model.invoke([new HumanMessage('Step 2')]);
    expect(accumulator.tokensIn).toBe(200);
    expect(accumulator.tokensOut).toBe(105);
    expect(accumulator.calls.length).toBe(2);
  });

  it('clearScriptedModel restores default createModel behavior', () => {
    installScriptedModel(['test']);
    clearScriptedModel();

    // Default provider in test config is 'fake' (from serverEnv.AI_PROVIDER)
    const model = createModel('cheap');
    expect(model).toBeDefined();
    expect(model._llmType()).not.toBe('scripted-fake-chat-model');
  });
});
