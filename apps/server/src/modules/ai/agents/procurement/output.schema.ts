// apps/server/src/modules/ai/agents/procurement/output.schema.ts
import { z } from 'zod';

export const procurementOutputSchema = z.object({
  /** The agent's structured answer — key procurement figures + narrative */
  answer: z.object({
    narrative: z.string().describe('Plain-language explanation of the procurement status'),
    figures: z
      .array(
        z.object({
          label: z.string(),
          value: z.union([z.number(), z.string()]),
          currency: z.string().optional(),
          unit: z.string().optional(),
          source: z.object({
            toolName: z.string(),
            resultPath: z.string().describe('JSONPath to value in tool result'),
          }).optional(),
        }),
      )
      .default([]),
    confidence: z
      .enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA'])
      .default('HIGH')
      .describe('Confidence level in the answer based on data availability'),
    missingData: z
      .array(z.string())
      .optional()
      .describe('List of missing data points that would improve the answer'),
  }),
  summary: z.string().max(500),
  citations: z.array(
    z.object({
      toolName: z.string(),
      snippet: z.string(),
      figureLabels: z.array(z.string()).optional().describe('Which figures this citation supports'),
    }),
  ),
});

export type ProcurementOutput = z.infer<typeof procurementOutputSchema>;

