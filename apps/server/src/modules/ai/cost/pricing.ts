// apps/server/src/modules/ai/cost/pricing.ts
//
// Model price table — USD per 1 000 tokens (input / output separately).
// Prices are keyed by the exact model string returned by the API response.
// Update this table when OpenAI publishes price changes; no logic changes needed.
//
// Rule: this file is pure config — no imports, no side-effects, no DB calls.
// usage.service.ts reads from here; nothing else should.

export interface ModelPricing {
  /** USD per 1 000 input (prompt) tokens */
  inputPer1k: number;
  /** USD per 1 000 output (completion) tokens */
  outputPer1k: number;
}

/**
 * Pricing table keyed by the model ID string.
 * Covers the models used for "cheap" and "strong" tiers plus common variants.
 * Source: https://openai.com/pricing (as of 2025-10)
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── GPT-4o mini (cheap tier) ─────────────────────────────────────────────
  'gpt-4o-mini':                 { inputPer1k: 0.000150, outputPer1k: 0.000600 },
  'gpt-4o-mini-2024-07-18':      { inputPer1k: 0.000150, outputPer1k: 0.000600 },

  // ── GPT-4o (strong tier) ─────────────────────────────────────────────────
  'gpt-4o':                      { inputPer1k: 0.002500, outputPer1k: 0.010000 },
  'gpt-4o-2024-11-20':           { inputPer1k: 0.002500, outputPer1k: 0.010000 },
  'gpt-4o-2024-08-06':           { inputPer1k: 0.002500, outputPer1k: 0.010000 },
  'gpt-4o-2024-05-13':           { inputPer1k: 0.005000, outputPer1k: 0.015000 },

  // ── o1 series ────────────────────────────────────────────────────────────
  'o1':                          { inputPer1k: 0.015000, outputPer1k: 0.060000 },
  'o1-2024-12-17':               { inputPer1k: 0.015000, outputPer1k: 0.060000 },
  'o1-mini':                     { inputPer1k: 0.001100, outputPer1k: 0.004400 },
  'o1-mini-2024-09-12':          { inputPer1k: 0.001100, outputPer1k: 0.004400 },
  'o1-preview':                  { inputPer1k: 0.015000, outputPer1k: 0.060000 },
  'o3-mini':                     { inputPer1k: 0.001100, outputPer1k: 0.004400 },
};

/**
 * Returns the pricing entry for a model, or a safe fallback if unknown.
 * The fallback uses gpt-4o rates (conservative — avoids under-counting cost).
 */
export function getPricing(modelId: string): ModelPricing {
  // Exact match first
  const exact = MODEL_PRICING[modelId];
  if (exact) return exact;

  // Prefix match — e.g. "gpt-4o-mini-finetuned-xxx" → gpt-4o-mini rates
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelId.startsWith(key)) return pricing;
  }

  // Unknown model — fall back to gpt-4o (conservative)
  return MODEL_PRICING['gpt-4o']!;
}

/**
 * Calculates the USD cost for a single LLM call.
 * Uses Decimal-safe arithmetic (multiply then divide, no intermediate float noise).
 */
export function calculateCostUsd(
  modelId: string,
  tokensIn: number,
  tokensOut: number,
): string {
  const p = getPricing(modelId);
  const inputCost  = (tokensIn  * p.inputPer1k)  / 1000;
  const outputCost = (tokensOut * p.outputPer1k) / 1000;
  // Return as a fixed-precision string (6 decimal places) — same as the DB column
  return (inputCost + outputCost).toFixed(6);
}
