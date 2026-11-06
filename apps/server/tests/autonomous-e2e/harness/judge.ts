// apps/server/tests/autonomous-e2e/harness/judge.ts
// LLM-as-judge for semantic quality checks
// Temperature 0, Zod-structured output
// Used ONLY for semantic quality (groundedness, helpfulness, routing, tone)
// Security/side-effect assertions remain deterministic (never judge-based)

import { z } from 'zod';
import { GeminiWrapper } from './gemini-wrapper.js';
import pino from 'pino';

const logger = pino({ name: 'judge' });

// Judgment schemas
const GroundednessJudgment = z.object({
  grounded: z.boolean().describe('Are all facts in the answer present in tool outputs?'),
  reasoning: z.string().describe('Explain why grounded or not'),
  unsupportedClaims: z.array(z.string()).optional().describe('List any claims not found in tool outputs'),
});

const HelpfulnessJudgment = z.object({
  helpful: z.boolean().describe('Does the answer address the user question effectively?'),
  reasoning: z.string().describe('Explain why helpful or not'),
});

const ToneJudgment = z.object({
  tone: z.enum(['professional', 'friendly', 'concise', 'verbose', 'unclear']).describe('Overall tone'),
  appropriate: z.boolean().describe('Is tone appropriate for construction industry?'),
  reasoning: z.string().describe('Explain tone assessment'),
});

const RoutingJudgment = z.object({
  correct: z.boolean().describe('Did coordinator route to the right agent?'),
  expectedAgent: z.string().describe('Which agent should have been called?'),
  actualAgent: z.string().describe('Which agent was actually called?'),
  reasoning: z.string().describe('Explain routing decision'),
});

export type GroundednessResult = z.infer<typeof GroundednessJudgment>;
export type HelpfulnessResult = z.infer<typeof HelpfulnessJudgment>;
export type ToneResult = z.infer<typeof ToneJudgment>;
export type RoutingResult = z.infer<typeof RoutingJudgment>;

export class Judge {
  private wrapper: GeminiWrapper;
  private calibrationResults: Array<{ predicted: boolean; actual: boolean }> = [];

  constructor(budgetCap: number = 5.0) {
    this.wrapper = new GeminiWrapper(budgetCap);
  }

  /**
   * Evaluate groundedness: Are all facts in the answer present in tool outputs?
   */
  async evaluateGroundedness(params: {
    question: string;
    answer: string;
    toolOutputs: Array<Record<string, unknown>>;
  }): Promise<GroundednessResult> {
    const prompt = `You are evaluating whether an AI agent's answer is grounded in the provided tool outputs.

USER QUESTION:
${params.question}

AGENT ANSWER:
${params.answer}

TOOL OUTPUTS:
${JSON.stringify(params.toolOutputs, null, 2)}

TASK:
Determine if EVERY factual claim in the agent answer is directly supported by the tool outputs.
- Numbers, dates, names, statuses must appear verbatim in tool outputs
- Do not allow the agent to compute, infer, or extrapolate
- If the agent says "$100k budget" but tools show "$100,000", that is GROUNDED (formatting ok)
- If the agent says "$100k budget" but tools show "$95,000", that is NOT GROUNDED

Respond in JSON format with:
{
  "grounded": true/false,
  "reasoning": "explain your decision",
  "unsupportedClaims": ["list any claims not found in tools"]
}`;

    const result = await this.wrapper.chatCompletion({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 500,
    });

    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    return GroundednessJudgment.parse(parsed);
  }

  /**
   * Evaluate helpfulness: Does the answer address the user question?
   */
  async evaluateHelpfulness(params: {
    question: string;
    answer: string;
  }): Promise<HelpfulnessResult> {
    const prompt = `You are evaluating whether an AI agent's answer is helpful.

USER QUESTION:
${params.question}

AGENT ANSWER:
${params.answer}

TASK:
Determine if the answer actually addresses what the user asked.
- Does it answer the specific question?
- Is it actionable if the user needed to act?
- Is it complete or does it leave gaps?

Respond in JSON format with:
{
  "helpful": true/false,
  "reasoning": "explain your decision"
}`;

    const result = await this.wrapper.chatCompletion({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 300,
    });

    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    return HelpfulnessJudgment.parse(parsed);
  }

  /**
   * Evaluate tone: Is the response professional and appropriate?
   */
  async evaluateTone(params: {
    answer: string;
    expectedTone?: 'professional' | 'friendly' | 'concise';
  }): Promise<ToneResult> {
    const prompt = `You are evaluating the tone of an AI agent's answer for a construction project management context.

AGENT ANSWER:
${params.answer}

EXPECTED TONE: ${params.expectedTone || 'professional'}

TASK:
Assess the tone and appropriateness for construction industry professionals.
- Professional: formal, clear, industry-appropriate
- Friendly: warm but still professional
- Concise: brief, to-the-point
- Verbose: unnecessarily long
- Unclear: confusing or ambiguous

Respond in JSON format with:
{
  "tone": "professional" | "friendly" | "concise" | "verbose" | "unclear",
  "appropriate": true/false,
  "reasoning": "explain tone assessment"
}`;

    const result = await this.wrapper.chatCompletion({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 300,
    });

    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    return ToneJudgment.parse(parsed);
  }

  /**
   * Evaluate routing: Did coordinator route to the correct agent?
   */
  async evaluateRouting(params: {
    question: string;
    actualAgent: string;
    availableAgents: string[];
  }): Promise<RoutingResult> {
    const prompt = `You are evaluating whether a coordinator AI routed a question to the correct specialist agent.

USER QUESTION:
${params.question}

AVAILABLE AGENTS:
${params.availableAgents.map(a => `- ${a}`).join('\n')}

ACTUALLY ROUTED TO: ${params.actualAgent}

TASK:
Determine which agent SHOULD handle this question and if the routing was correct.

Agent descriptions:
- cost-financial: budgets, costs, billing, cash flow, financial summaries
- procurement: purchase orders, quotes, deliveries, vendor management
- compliance: safety, quality, permits, inspections, regulations
- estimating-boq: bill of quantities, takeoffs, estimates, cost codes
- reports: generate summaries, executive reports, dashboards
- coordinator: handles multi-domain queries that need multiple agents

Respond in JSON format with:
{
  "correct": true/false,
  "expectedAgent": "which agent should handle this",
  "actualAgent": "${params.actualAgent}",
  "reasoning": "explain routing decision"
}`;

    const result = await this.wrapper.chatCompletion({
      model: 'gemini-3.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 300,
    });

    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    return RoutingJudgment.parse(parsed);
  }

  /**
   * Record calibration result (for Cohen's kappa calculation)
   */
  recordCalibration(predicted: boolean, actual: boolean): void {
    this.calibrationResults.push({ predicted, actual });
  }

  /**
   * Calculate Cohen's kappa (inter-rater agreement)
   * Compares judge predictions vs human labels
   */
  calculateKappa(): number {
    if (this.calibrationResults.length < 20) {
      logger.warn('Not enough calibration samples (need ≥20)');
      return 0;
    }

    const n = this.calibrationResults.length;
    
    // Observed agreement
    const agreements = this.calibrationResults.filter(r => r.predicted === r.actual).length;
    const po = agreements / n;

    // Expected agreement by chance
    const yesYes = this.calibrationResults.filter(r => r.predicted && r.actual).length;
    const yesNo = this.calibrationResults.filter(r => r.predicted && !r.actual).length;
    const noYes = this.calibrationResults.filter(r => !r.predicted && r.actual).length;
    const noNo = this.calibrationResults.filter(r => !r.predicted && !r.actual).length;

    const pYes = (yesYes + yesNo) / n;
    const pNo = (noYes + noNo) / n;
    const pActualYes = (yesYes + noYes) / n;
    const pActualNo = (yesNo + noNo) / n;

    const pe = (pYes * pActualYes) + (pNo * pActualNo);

    // Cohen's kappa
    const kappa = (po - pe) / (1 - pe);

    logger.info(
      { n, po, pe, kappa, agreements },
      'Cohen kappa calculated',
    );

    return kappa;
  }

  /**
   * Get judge spending
   */
  getSpent(): number {
    return this.wrapper.getSpent();
  }
}
