// apps/server/src/modules/ai/guardrails/output-guard.ts
//
// Validates agent output before it is written to agent_runs.output.
// Two checks:
//   1. Schema validation — output must conform to the agent's Zod output schema
//   2. Number provenance — any numeric field in the answer must have a matching
//      citation in the tool call log (LLMs must not do money math; Chunk 3 rule 3)

import type { z } from 'zod';
import { createLogger } from '@siteflow/observability/server';
import type { AgentRunOutput } from '../core/types.js';

const logger = createLogger({ name: 'ai-output-guard' });

// ── Schema validation ─────────────────────────────────────────────────────────

/**
 * Validates the agent's raw output against a Zod schema.
 * Returns the parsed output on success, throws on failure.
 */
export function validateOutput<TSchema extends z.ZodTypeAny>(
  output: unknown,
  schema: TSchema,
  agentName: string,
): z.output<TSchema> {
  const result = schema.safeParse(output);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    logger.warn({ agentName, issues }, 'Agent output failed schema validation');
    throw new Error(`Output schema validation failed for agent "${agentName}": ${issues}`);
  }
  return result.data;
}

// ── Number provenance check ───────────────────────────────────────────────────
// Walk the answer object and flag any numeric value that doesn't appear
// verbatim in at least one tool call result summary.
// This is a best-effort heuristic — not a cryptographic proof.

export interface ProvenanceWarning {
  path: string;
  value: number;
}

/**
 * Checks that numeric values in the answer are traceable to tool results.
 * Returns an array of warnings (does NOT throw — logged and stored for audit).
 *
 * Call this after validateOutput(). The runner logs warnings but does not
 * block the run — a future hardening pass can flip this to a hard error.
 */
export function checkNumberProvenance(
  output: AgentRunOutput,
  toolResultSummaries: Array<Record<string, unknown>>,
): ProvenanceWarning[] {
  const warnings: ProvenanceWarning[] = [];

  // Flatten all tool result summaries into a single string for fast lookup
  const resultBlob = JSON.stringify(toolResultSummaries);

  function walk(node: unknown, path: string): void {
    if (node === null || node === undefined) return;
    if (typeof node === 'number') {
      // Check if this number appears somewhere in the tool results
      if (!resultBlob.includes(String(node))) {
        warnings.push({ path, value: node });
      }
      return;
    }
    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        walk(val, path ? `${path}.${key}` : key);
      }
    }
  }

  walk(output.answer, 'answer');

  if (warnings.length > 0) {
    logger.warn({ warnings }, 'Output provenance check: numbers not found in tool results');
  }

  return warnings;
}

/**
 * STRICT provenance enforcement: throws if any numeric values in the answer
 * cannot be traced to tool results. This is the hardened version that blocks
 * runs where the LLM invented numbers.
 *
 * Use this for production cost-financial agent to enforce NO-DRIFT rule #7:
 * "Model never computes numbers — all figures must come from tool results."
 *
 * @param output - The validated agent output
 * @param toolResultSummaries - Array of tool call results from the run
 * @param agentName - Agent name for error messages
 * @throws Error if any numbers are not found in tool results
 */
export function enforceNumberProvenance(
  output: AgentRunOutput,
  toolResultSummaries: Array<Record<string, unknown>>,
  agentName: string,
): void {
  const warnings = checkNumberProvenance(output, toolResultSummaries);

  if (warnings.length > 0) {
    const details = warnings.map((w) => `${w.path}=${w.value}`).join(', ');
    logger.error(
      { agentName, warnings },
      'Provenance enforcement FAILED: numbers not found in tool results',
    );
    throw new Error(
      `Provenance violation in agent "${agentName}": The following numeric values were not found in any tool result: ${details}. ` +
      `All figures must come directly from tool calls — the model must not compute or invent numbers.`,
    );
  }
}

export function enforceFigureProvenance(
  figures: Array<{ label: string; value: string | number; currency?: string }>,
  toolResults: Array<Record<string, unknown>>,
  agentName: string,
): void {
  const sourceValues = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === 'string' || typeof value === 'number') {
      sourceValues.add(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(collect);
    }
  };
  collect(toolResults);

  const unsupported = figures.filter((figure) => {
    const value = String(figure.value);
    const numeric = typeof figure.value === 'number' || /^-?\d+(?:\.\d+)?$/.test(value);
    return (numeric || figure.currency !== undefined) && !sourceValues.has(value);
  });
  if (unsupported.length > 0) {
    const details = unsupported.map((figure) => `${figure.label}=${figure.value}`).join(', ');
    logger.error({ agentName, unsupportedFigures: details }, 'Figure provenance enforcement FAILED');
    throw new Error(
      `Figure provenance violation in agent "${agentName}": ${details}. ` +
      'Numeric figures must appear verbatim in tool results.',
    );
  }
}

// ── PII Redaction ─────────────────────────────────────────────────────────────
// Redacts sensitive data patterns from tool results before returning to LLM/storage

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  // SSN: 123-45-6789 or 123456789
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]', label: 'ssn' },
  { pattern: /\b\d{9}\b/g, replacement: '[REDACTED_SSN]', label: 'ssn-no-dash' },
  
  // Credit card: 4532-1234-5678-9010 or 4532123456789010
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[REDACTED_CARD]', label: 'credit-card' },
  
  // Email: user@domain.com
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]', label: 'email' },
  
  // Phone: +1-555-123-4567, (555) 123-4567, 555.123.4567, 5551234567
  { pattern: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[REDACTED_PHONE]', label: 'phone' },
  
  // API keys: sk_test_abc123, pk_live_xyz789
  { pattern: /\b[a-z]{2}_(?:test|live)_[A-Za-z0-9]{16,}\b/g, replacement: '[REDACTED_API_KEY]', label: 'api-key' },
  
  // Bearer tokens: Bearer eyJhbGciOi...
  { pattern: /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi, replacement: 'Bearer [REDACTED_JWT]', label: 'jwt' },
  
  // Generic secrets (common env var patterns)
  { pattern: /\b(secret|password|token|key)\s*[:=]\s*['"]?([^'"\s,}]+)['"]?/gi, replacement: '$1: [REDACTED]', label: 'secret-kv' },
];

/**
 * Redacts PII and sensitive data from tool results before storage/logging.
 * This is applied to the result AFTER execution and BEFORE audit log + return.
 * 
 * @param result - Tool execution result (any type)
 * @param toolName - Tool name for logging
 * @returns Redacted copy of result (original unchanged)
 */
export function redactPII<T>(result: T, toolName: string): T {
  if (result === null || result === undefined) {
    return result;
  }

  // Convert to JSON, apply patterns, parse back
  const json = JSON.stringify(result);
  let redacted = json;
  const appliedPatterns: string[] = [];

  for (const { pattern, replacement, label } of PII_PATTERNS) {
    const before = redacted;
    redacted = redacted.replace(pattern, replacement);
    if (before !== redacted) {
      appliedPatterns.push(label);
    }
  }

  if (appliedPatterns.length > 0) {
    logger.info(
      { toolName, patterns: appliedPatterns },
      'PII redaction applied to tool result',
    );
  }

  try {
    return JSON.parse(redacted) as T;
  } catch {
    // If parse fails (shouldn't happen), return original
    logger.warn({ toolName }, 'PII redaction JSON parse failed, returning original');
    return result;
  }
}
