// apps/server/src/modules/ai/guardrails/input-guard.ts
//
// Sanitises and labels untrusted text before it enters the graph.
// Rule 6: uploaded documents and retrieved text are UNTRUSTED DATA, never instructions.
//
// Two passes:
//   1. Injection heuristics — pattern-based; cheap, runs on every input
//   2. Label — attaches a trust level tag so prompts can quote the text safely

import { createLogger } from '@siteflow/observability/server';
import { GuardrailBlockedError } from '../core/errors.js';

const logger = createLogger({ name: 'ai-input-guard' });

// ── Injection patterns ────────────────────────────────────────────────────────
// Keep these simple and fast. The goal is to catch obvious prompt-injection
// attempts in user-supplied or document-sourced text. Not a comprehensive filter.

const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?)/i, label: 'ignore-instructions' },
  { pattern: /you\s+are\s+now\s+a?\s*(different|new|another)?\s*(ai|assistant|bot|model|llm)/i,   label: 'persona-override' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|rules?)/i,         label: 'disregard-instructions' },
  { pattern: /\[system\]/i,                                                                          label: 'fake-system-tag' },
  { pattern: /\<\|im_start\|\>/i,                                                                    label: 'chatml-injection' },
  { pattern: /print\s+(your\s+)?(system\s+prompt|instructions|rules)/i,                             label: 'exfiltration-attempt' },
  { pattern: /reveal\s+(your\s+)?(system\s+prompt|instructions|rules|api key)/i,                    label: 'exfiltration-attempt' },
  { pattern: /approve\s+this|authorise\s+this|authorize\s+this/i,                                   label: 'approval-injection' },
];

export type TrustLevel = 'TRUSTED' | 'EXTERNAL' | 'UNTRUSTED';

export interface GuardedText {
  /** The original text — unchanged (we label, never mutate) */
  text: string;
  trustLevel: TrustLevel;
  /** True when the text triggered an injection heuristic */
  flagged: boolean;
  /** Which heuristic fired, if any */
  flags: string[];
}

/**
 * Scan a string for injection patterns.
 * - TRUSTED sources (e.g. system fields from the DB): skip scan, return as-is
 * - EXTERNAL sources (e.g. API responses from partners): scan, log flags, allow
 * - UNTRUSTED sources (e.g. uploaded docs, user freetext): scan, block on match
 *
 * @throws GuardrailBlockedError if trustLevel is UNTRUSTED and a pattern matches
 */
export function guardInput(text: string, trustLevel: TrustLevel): GuardedText {
  // Trusted content (DB values, structured API data) — skip scan entirely
  if (trustLevel === 'TRUSTED') {
    return { text, trustLevel, flagged: false, flags: [] };
  }

  const flags: string[] = [];

  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(label);
    }
  }

  if (flags.length === 0) {
    return { text, trustLevel, flagged: false, flags: [] };
  }

  // EXTERNAL: log and continue — useful for auditing partner data
  if (trustLevel === 'EXTERNAL') {
    logger.warn({ trustLevel, flags }, 'Injection patterns detected in EXTERNAL text — allowing with warning');
    return { text, trustLevel, flagged: true, flags };
  }

  // UNTRUSTED: block
  logger.warn({ trustLevel, flags }, 'Injection attempt detected in UNTRUSTED text — blocking');
  throw new GuardrailBlockedError(`Injection pattern detected: ${flags.join(', ')}`);
}

/**
 * Wraps untrusted text in a safe quoting envelope for LLM prompts.
 * Agents must use this when inserting document content into a prompt.
 *
 * Example:
 *   quoteUntrusted("some user text") →
 *   "<untrusted_data>\nsome user text\n</untrusted_data>"
 */
export function quoteUntrusted(text: string): string {
  return `<untrusted_data>\n${text}\n</untrusted_data>`;
}
