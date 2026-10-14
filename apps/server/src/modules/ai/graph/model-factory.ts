// apps/server/src/modules/ai/graph/model-factory.ts
//
// Returns a configured ChatOpenAI instance for a given model tier.
// Agent code always asks for a tier ("cheap" | "strong") — never a model name.
// The concrete model is resolved from env vars, so swapping models requires
// only an env change, not a code change.
//
// Usage tracking integration:
//   Pass a UsageAccumulator as the second argument and the factory wires a
//   LangChain callback handler that calls accumulator.record() after every call.

import { ChatOpenAI } from '@langchain/openai';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { serverEnv } from '../../../config/env.js';
import { createLogger } from '@siteflow/observability/server';
import type { ModelTier } from '../core/types.js';
import type { UsageAccumulator } from '../cost/usage.service.js';

const logger = createLogger({ name: 'ai-model-factory' });

// ── Callback handler — wires token counts into the accumulator ────────────────

function makeUsageCallback(accumulator: UsageAccumulator): Partial<BaseCallbackHandler> {
  return {
    name: 'ai-usage-callback',
    handleLLMEnd(output, _runId) {
      try {
        // LangChain surfaces token usage in output.llmOutput.tokenUsage
        const usage = (output as any)?.llmOutput?.tokenUsage;
        if (!usage) return;

        const modelId: string =
          (output as any)?.generations?.[0]?.[0]?.generationInfo?.model ??
          serverEnv.AI_MODEL_CHEAP; // fallback — usage is still recorded

        accumulator.record(
          modelId,
          usage.promptTokens     ?? 0,
          usage.completionTokens ?? 0,
        );
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
 * Returns a ChatOpenAI instance for the given tier.
 *
 * "cheap"  → AI_MODEL_CHEAP  (default: gpt-4o-mini)  — fast, low-cost, multi-step reasoning
 * "strong" → AI_MODEL_STRONG (default: gpt-4o)        — capable, used for final synthesis
 *
 * Never call new ChatOpenAI() directly in agent or runner code.
 * Always go through this factory so model names stay out of business logic.
 */
export function createModel(
  tier: ModelTier,
  opts: ModelFactoryOptions = {},
): ChatOpenAI {
  const modelName = tier === 'strong' ? serverEnv.AI_MODEL_STRONG : serverEnv.AI_MODEL_CHEAP;

  if (!serverEnv.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is not set. Configure it in .env to enable AI features.',
    );
  }

  logger.debug({ tier, modelName }, 'Creating LLM instance');

  const callbacks: Array<Partial<BaseCallbackHandler>> = [];
  if (opts.accumulator) {
    callbacks.push(makeUsageCallback(opts.accumulator));
  }

  return new ChatOpenAI({
    model: modelName,
    apiKey: serverEnv.OPENAI_API_KEY,
    temperature: opts.temperature ?? (tier === 'strong' ? 0.2 : 0.0),
    maxTokens: opts.maxTokens,
    // Stream is off by default — runner controls streaming if needed
    streaming: false,
    callbacks: callbacks.length > 0 ? (callbacks as BaseCallbackHandler[]) : undefined,
  });
}
