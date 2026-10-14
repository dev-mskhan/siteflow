// apps/server/src/modules/ai/agents/cost-financial/output.schema.ts
import { z } from 'zod';

export const costFinancialOutputSchema = z.object({
  /** The agent's structured answer — key financial figures + narrative */
  answer: z.object({
    narrative: z.string().describe('Plain-language explanation of the financial position'),
    figures: z
      .array(
        z.object({
          label: z.string(),
          value: z.union([z.number(), z.string()]),
          currency: z.string().optional(),
        }),
      )
      .default([]),
  }),
  summary: z.string().max(500),
  citations: z.array(
    z.object({ toolName: z.string(), snippet: z.string() }),
  ),
});

export type CostFinancialOutput = z.infer<typeof costFinancialOutputSchema>;
