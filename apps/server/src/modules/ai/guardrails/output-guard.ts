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
export function validateOutput<T>(
  output: unknown,
  schema: z.ZodType<T>,
  agentName: string,
): T {
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
