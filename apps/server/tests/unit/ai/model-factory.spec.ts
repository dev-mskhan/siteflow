import { describe, expect, it } from 'vitest';
import {
  assertSafeLlmBaseUrl,
  isLoopbackOrPrivateBaseUrl,
  resolveTokenUsage,
} from '../../../src/modules/ai/graph/model-factory.js';
import { calculateCostUsd, getPricing } from '../../../src/modules/ai/cost/pricing.js';

describe('AI model configuration', () => {
  it('rejects private and loopback OpenAI endpoints in production', () => {
    for (const baseUrl of [
      'http://127.0.0.1:8081/v1',
      'http://10.2.3.4/v1',
      'http://172.20.1.1/v1',
      'http://192.168.1.9/v1',
      'http://[::1]:8081/v1',
      'http://proxy.local/v1',
    ]) {
      expect(() => assertSafeLlmBaseUrl('production', baseUrl)).toThrow(/production/);
    }
    expect(() => assertSafeLlmBaseUrl('production', 'https://api.openai.com/v1')).not.toThrow();
    expect(() => assertSafeLlmBaseUrl('development', 'http://127.0.0.1:8081/v1')).not.toThrow();
  });

  it('enables zero-cost dev model pricing only when local proxy pricing is allowed', () => {
    expect(isLoopbackOrPrivateBaseUrl('http://127.0.0.1:8081/v1')).toBe(true);
    expect(isLoopbackOrPrivateBaseUrl('https://api.openai.com/v1')).toBe(false);
    expect(getPricing('gemini-3.5-flash', true)).toEqual({
      inputPer1k: 0,
      outputPer1k: 0,
    });
    expect(getPricing('gemini-3.5-flash')).toEqual(getPricing('unknown-model'));
    expect(calculateCostUsd('gemini-3.5-flash', 1000, 1000, true)).toBe('0.000000');
    expect(calculateCostUsd('gpt-4o-mini', 1000, 1000)).toBe('0.000750');
  });

  it('estimates missing provider usage from prompt and output characters', () => {
    expect(resolveTokenUsage(undefined, 20, 12)).toEqual({
      tokensIn: 5,
      tokensOut: 3,
      usageSource: 'estimated',
    });
    expect(resolveTokenUsage({ promptTokens: 7, completionTokens: 2 }, 20, 12)).toEqual({
      tokensIn: 7,
      tokensOut: 2,
      usageSource: 'provider-reported',
    });
  });
});
