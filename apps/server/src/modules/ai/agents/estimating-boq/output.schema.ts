// apps/server/src/modules/ai/agents/estimating-boq/output.schema.ts
import { z } from 'zod';

export const draftBoqLineSchema = z.object({
  description: z.string().describe('Work item description extracted from the spec.'),
  unit: z.string().describe('Unit of measure (e.g. m2, m3, EA, KG, HR).'),
  quantity: z.string().describe('Quantity as a string — must come verbatim from a tool result or measurement.'),
  costCodeId: z.string().optional().describe('Matched cost code UUID from list_cost_codes, if found.'),
  costCode: z.string().optional().describe('Cost code text (e.g. "03.21.10") for human readability.'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('HIGH=exact match, MEDIUM=partial, LOW=inferred—human must verify.'),
  source: z.object({
    toolName: z.string(),
    resultPath: z.string().describe('JSONPath or description of where this line was found.'),
    snippet: z.string().describe('Short excerpt from the source that supports this line.'),
  }),
});

export const estimatingBoqOutputSchema = z.object({
  answer: z.object({
    narrative: z.string().describe('Plain-language explanation of what was extracted and how.'),
    figures: z.array(
      z.object({
        label: z.string(),
        value: z.union([z.number(), z.string()]),
        unit: z.string().optional(),
        source: z.object({ toolName: z.string(), resultPath: z.string() }).optional(),
      }),
    ).default([]),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA']).default('HIGH'),
    missingData: z.array(z.string()).optional(),
  }),
  /** Draft BOQ lines for human review — never submitted or approved automatically */
  draft: z.array(draftBoqLineSchema).default([]),
  /** Validation issues found during extraction (duplicates, unit mismatches, zero quantities) */
  validationIssues: z.array(z.object({
    lineIndex: z.number(),
    issue: z.string(),
    severity: z.enum(['ERROR', 'WARNING']),
  })).default([]),
  summary: z.string().max(500),
  citations: z.array(
    z.object({
      toolName: z.string(),
      snippet: z.string(),
      documentId: z.string().optional(),
      versionNumber: z.number().optional(),
      pageReference: z.string().optional(),
    }),
  ),
});

export type EstimatingBoqOutput = z.infer<typeof estimatingBoqOutputSchema>;
export type DraftBoqLine = z.infer<typeof draftBoqLineSchema>;
