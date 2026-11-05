// apps/server/src/modules/ai/agents/compliance/output.schema.ts
import { z } from 'zod';

export const complianceOutputSchema = z.object({
  answer: z.object({
    narrative: z.string().describe('Plain-language explanation of the compliance status'),
    figures: z.array(
      z.object({
        label: z.string(),
        value: z.union([z.number(), z.string()]),
        unit: z.string().optional(),
        source: z.object({
          toolName: z.string(),
          resultPath: z.string(),
        }).optional(),
      }),
    ).default([]),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA']).default('HIGH'),
    missingData: z.array(z.string()).optional(),
  }),
  summary: z.string().max(500),
  citations: z.array(
    z.object({
      toolName: z.string(),
      snippet: z.string(),
      /** documentId if this citation comes from a RAG search result */
      documentId: z.string().optional(),
      versionNumber: z.number().optional(),
      pageReference: z.string().optional(),
    }),
  ),
});

export type ComplianceOutput = z.infer<typeof complianceOutputSchema>;
