// apps/server/tests/helpers/ai/fake-model.ts
import { BaseChatModel, type BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { setModelOverride } from '../../../src/modules/ai/graph/model-factory.js';
import type { UsageAccumulator } from '../../../src/modules/ai/cost/usage.service.js';

export interface ScriptedToolCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export interface ScriptedResponse {
  text?: string;
  toolCalls?: ScriptedToolCall[];
  tokensIn?: number;
  tokensOut?: number;
}

export type ScriptedResponseInput = string | ScriptedResponse;

export class ScriptedFakeChatModel extends BaseChatModel {
  private responses: ScriptedResponse[] = [];
  public modelName: string;
  public invocations: BaseMessage[][] = [];

  constructor(
    responses: ScriptedResponseInput[] = [],
    params: BaseChatModelParams & { modelName?: string } = {},
  ) {
    super(params);
    this.modelName = params.modelName ?? 'fake-scripted-model';
    for (const r of responses) {
      this.pushResponse(r);
    }
  }

  _llmType(): string {
    return 'scripted-fake-chat-model';
  }

  pushResponse(res: ScriptedResponseInput): void {
    if (typeof res === 'string') {
      this.responses.push({ text: res, tokensIn: 10, tokensOut: 20 });
    } else {
      this.responses.push({
        text: res.text ?? '',
        toolCalls: res.toolCalls,
        tokensIn: res.tokensIn ?? 10,
        tokensOut: res.tokensOut ?? 20,
      });
    }
  }

  override bindTools(tools: unknown[], _kwargs?: Partial<any>): this {
    // Return this so agent code chaining .bindTools(tools) functions transparently
    return this;
  }

  async _generate(
    messages: BaseMessage[],
    _options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    this.invocations.push(messages);

    const nextResponse = this.responses.shift() ?? {
      text: '{"status":"ok"}',
      tokensIn: 10,
      tokensOut: 20,
    };

    const toolCalls = (nextResponse.toolCalls ?? []).map((tc, index) => ({
      name: tc.name,
      args: tc.args,
      id: tc.id ?? `call_${index}_${Date.now()}`,
      type: 'tool_call' as const,
    }));

    const aiMessage = new AIMessage({
      content: nextResponse.text ?? '',
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    });

    return {
      generations: [
        {
          text: nextResponse.text ?? '',
          message: aiMessage,
          generationInfo: { model: this.modelName },
        },
      ],
      llmOutput: {
        tokenUsage: {
          promptTokens: nextResponse.tokensIn ?? 10,
          completionTokens: nextResponse.tokensOut ?? 20,
        },
      },
    };
  }
}

let activeScriptedModel: ScriptedFakeChatModel | null = null;

/**
 * Installs a test-scoped scripted fake model that intercepts createModel calls.
 */
export function installScriptedModel(
  responses: ScriptedResponseInput[] = [],
  modelName = 'gemini-3.5-flash',
): ScriptedFakeChatModel {
  const model = new ScriptedFakeChatModel(responses, { modelName });
  activeScriptedModel = model;

  setModelOverride((_tier, opts) => {
    // If the caller provided an accumulator, wire the callback
    if (opts.accumulator) {
      const handler: Partial<BaseCallbackHandler> = {
        name: 'test-fake-usage-callback',
        handleLLMEnd(output) {
          const usage = (output as any)?.llmOutput?.tokenUsage;
          const mId =
            (output as any)?.generations?.[0]?.[0]?.generationInfo?.model ??
            model.modelName;
          opts.accumulator!.record(
            mId,
            usage?.promptTokens ?? 10,
            usage?.completionTokens ?? 20,
          );
        },
      };
      model.callbacks = [handler as BaseCallbackHandler];
    }
    return model;
  });

  return model;
}

/**
 * Clears the active scripted model override.
 */
export function clearScriptedModel(): void {
  activeScriptedModel = null;
  setModelOverride(null);
}
