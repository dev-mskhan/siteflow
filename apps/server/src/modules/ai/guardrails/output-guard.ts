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
