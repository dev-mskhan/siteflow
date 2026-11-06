// apps/server/tests/autonomous-e2e/harness/gemini-wrapper.ts
// Thin wrapper around real Gemini API (via web2api) with:
// - Budget tracking (abort at cap)
// - Retry logic (429/500 with backoff)
// - Langfuse auto-tracing integration
// - Timeout enforcement

import { createLogger } from '@siteflow/observability/server';
import { config } from '@siteflow/env/server';

const logger = createLogger({ name: 'gemini-wrapper' });

export class BudgetExceededError extends Error {
  constructor(spent: number, cap: number) {
    super(`Budget cap of $${cap} exceeded. Spent: $${spent.toFixed(4)}`);
    this.name = 'BudgetExceededError';
  }
}

export class GeminiWrapper {
  private spent = 0;
  private readonly cap: number;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(budgetCap: number) {
    this.cap = budgetCap;
    this.baseUrl = config.OPENAI_BASE_URL || 'http://127.0.0.1:8081/v1';
    this.apiKey = config.OPENAI_API_KEY || 'sk-your-key';
  }

  /**
   * Calculate cost based on token usage and model
   * Pricing (approximate for gemini-flash via web2api):
   * - Input: $0.075 per 1M tokens
   * - Output: $0.30 per 1M tokens
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * 0.075;
    const outputCost = (outputTokens / 1_000_000) * 0.30;
    return inputCost + outputCost;
  }

  /**
   * Make a chat completion request with budget tracking and retry logic
   */
  async chatCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    tools?: Array<any>;
    tool_choice?: string | object;
  }): Promise<any> {
    const startTime = Date.now();
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (response.status === 429) {
          // Rate limit - exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn({ attempt, delay }, 'Rate limited, retrying after backoff');
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (response.status >= 500) {
          // Server error - retry
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn({ attempt, status: response.status, delay }, 'Server error, retrying');
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API error ${response.status}: ${error}`);
        }

        const data = await response.json();

        // Track cost
        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
        const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);
        this.spent += cost;

        logger.info(
          {
            model: params.model,
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            cost: cost.toFixed(6),
            totalSpent: this.spent.toFixed(4),
            latency: Date.now() - startTime,
          },
          'Gemini API call completed',
        );

        // Check budget after tracking
        if (this.spent > this.cap) {
          throw new BudgetExceededError(this.spent, this.cap);
        }

        return data;
      } catch (err) {
        if (err instanceof BudgetExceededError) {
          throw err; // Don't retry budget exceeded
        }

        if (attempt >= maxAttempts) {
          logger.error({ err, attempt }, 'Gemini API call failed after retries');
          throw err;
        }

        logger.warn({ err, attempt }, 'Gemini API call failed, retrying');
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Gemini API call failed after max attempts');
  }

  /**
   * Get current spend
   */
  getSpent(): number {
    return this.spent;
  }

  /**
   * Get remaining budget
   */
  getRemaining(): number {
    return this.cap - this.spent;
  }

  /**
   * Reset spend counter (for new test suite)
   */
  reset(): void {
    this.spent = 0;
  }
}
