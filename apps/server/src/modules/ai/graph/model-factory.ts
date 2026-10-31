// apps/server/src/modules/ai/graph/model-factory.ts
//
// Returns a configured BaseChatModel instance for a given model tier.
// Agent code always asks for a tier ("cheap" | "strong") — never a model name.
// Multi-provider support (H10): resolves provider ('openai' | 'google' | 'fake')
// and concrete model from env vars.
//
// Usage tracking integration:
//   Pass a UsageAccumulator as the second argument and the factory wires a
//   LangChain callback handler that calls accumulator.record() after every call.

import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { serverEnv } from '../../../config/env.js';
import { createLogger } from '@siteflow/observability/server';
import type { ModelTier } from '../core/types.js';
import type { UsageAccumulator } from '../cost/usage.service.js';

const logger = createLogger({ name: 'ai-model-factory' });

export interface TokenUsage {
  tokensIn: number;
  tokensOut: number;
  usageSource: 'provider-reported' | 'estimated';
}

export function resolveTokenUsage(
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  } | undefined,
  promptCharacters: number,
  outputCharacters: number,
): TokenUsage {
  const tokensIn = usage?.promptTokens ?? usage?.input_tokens;
  const tokensOut = usage?.completionTokens ?? usage?.output_tokens;
  const estimated = tokensIn === undefined || tokensOut === undefined;
  return {
    tokensIn: tokensIn ?? Math.ceil(promptCharacters / 4),
    tokensOut: tokensOut ?? Math.ceil(outputCharacters / 4),
    usageSource: estimated ? 'estimated' : 'provider-reported',
  };
}

function isPrivateOrLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host.startsWith('::ffff:')) return isPrivateOrLoopbackHostname(host.slice(7));

  const octets = host.split('.').map(Number);
  if (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first, second] = octets;
    return first === 0 || first === 10 || first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }

  return host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
}

export function isLoopbackOrPrivateBaseUrl(baseUrl: string): boolean {
  return isPrivateOrLoopbackHostname(new URL(baseUrl).hostname);
}

export function assertSafeLlmBaseUrl(
  nodeEnv: string,
  baseUrl: string | undefined,
): void {
  if (nodeEnv === 'production' && baseUrl && isLoopbackOrPrivateBaseUrl(baseUrl)) {
    throw new Error('OPENAI_BASE_URL cannot point to a loopback or private address in production.');
  }
}

assertSafeLlmBaseUrl(serverEnv.NODE_ENV, serverEnv.OPENAI_BASE_URL);

// ── Callback handler — wires token counts into the accumulator ────────────────

function makeUsageCallback(accumulator: UsageAccumulator, defaultModel: string): Partial<BaseCallbackHandler> {
  const promptCharactersByRun = new Map<string, number>();
  const savePromptLength = (runId: string, prompt: string): void => {
    promptCharactersByRun.set(runId, prompt.length);
  };
  return {
    name: 'ai-usage-callback',
    handleLLMStart(_llm, prompts, runId) {
      savePromptLength(runId, prompts.join(''));
    },
    handleChatModelStart(_llm, messages, runId) {
      savePromptLength(runId, JSON.stringify(messages));
    },
    handleLLMEnd(output, runId) {
      try {
        const llmOutput = output.llmOutput as Record<string, unknown> | undefined;
        const usage = (llmOutput?.tokenUsage ?? llmOutput?.usage) as
          | Parameters<typeof resolveTokenUsage>[0]
          | undefined;
        const modelId: string =
          (output as any)?.generations?.[0]?.[0]?.generationInfo?.model ??
          defaultModel;
        const outputCharacters = output.generations
          .flat()
          .reduce((total, generation) => total + (generation.text?.length ?? 0), 0);
        const usageCounts = resolveTokenUsage(
          usage,
          promptCharactersByRun.get(runId) ?? 0,
          outputCharacters,
        );
        accumulator.record(
          modelId,
          usageCounts.tokensIn,
          usageCounts.tokensOut,
          usageCounts.usageSource,
        );
        promptCharactersByRun.delete(runId);
      } catch (err) {
        // Never throw from a callback — just log and continue
        logger.warn({ err }, 'Usage callback error — token counts may be incomplete');
      }
    },
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface ModelFactoryOptions {
  /** Temperature override — defaults are tier-appropriate */
  temperature?: number;
  /** Max output tokens for this specific call */
  maxTokens?: number;
  /** If provided, token usage is recorded into this accumulator after each call */
  accumulator?: UsageAccumulator;
}

/**
 * Returns a BaseChatModel instance for the given tier.
 *
 * "cheap"  → AI_MODEL_CHEAP  (default: gpt-4o-mini or gemini-2.5-flash)
 * "strong" → AI_MODEL_STRONG (default: gpt-4o or gemini-2.5-pro)
 *
 * Supports providers:
 *   - 'openai' (default): ChatOpenAI
 *   - 'google': ChatGoogleGenerativeAI
 *   - 'fake': FakeListChatModel (deterministic test model, zero network, zero cost)
 */
let modelOverride: ((tier: ModelTier, opts: ModelFactoryOptions) => BaseChatModel) | null = null;

/**
 * For testing: set or clear a global override for createModel.
 */
export function setModelOverride(
  fn: ((tier: ModelTier, opts: ModelFactoryOptions) => BaseChatModel) | null,
): void {
  modelOverride = fn;
}

export function createModel(
  tier: ModelTier,
  opts: ModelFactoryOptions = {},
): BaseChatModel {
  if (modelOverride) {
    return modelOverride(tier, opts);
  }

  const provider = serverEnv.AI_PROVIDER;
  const modelName = tier === 'strong' ? serverEnv.AI_MODEL_STRONG : serverEnv.AI_MODEL_CHEAP;

  logger.debug({ provider, tier, modelName }, 'Creating LLM instance');

  const callbacks: Array<Partial<BaseCallbackHandler>> = [];
  if (opts.accumulator) {
    callbacks.push(makeUsageCallback(opts.accumulator, modelName));
  }

  // 1. Fake model for testing and CI
  if (provider === 'fake') {
    return new FakeListChatModel({
      responses: [
        '{"answer":null,"summary":"Fake test model completed.","citations":[]}',
      ],
      callbacks: callbacks.length > 0 ? (callbacks as BaseCallbackHandler[]) : undefined,
    });
  }

  // 2. Google Gemini provider
  if (provider === 'google') {
    if (!serverEnv.GOOGLE_API_KEY) {
      throw new Error(
        'GOOGLE_API_KEY is not set. Configure it in .env when AI_PROVIDER=google.',
      );
    }

    return new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: serverEnv.GOOGLE_API_KEY,
      temperature: opts.temperature ?? (tier === 'strong' ? 0.2 : 0.0),
      maxOutputTokens: opts.maxTokens,
      callbacks: callbacks.length > 0 ? (callbacks as BaseCallbackHandler[]) : undefined,
    });
  }

  // 3. OpenAI provider (default)
  if (!serverEnv.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is not set. Configure it in .env to enable AI features.',
    );
  }

  return new ChatOpenAI({
    model: modelName,
    apiKey: serverEnv.OPENAI_API_KEY,
    configuration: serverEnv.OPENAI_BASE_URL ? { baseURL: serverEnv.OPENAI_BASE_URL } : undefined,
    temperature: opts.temperature ?? (tier === 'strong' ? 0.2 : 0.0),
    maxTokens: opts.maxTokens,
    streaming: false,
    callbacks: callbacks.length > 0 ? (callbacks as BaseCallbackHandler[]) : undefined,
  });
}
