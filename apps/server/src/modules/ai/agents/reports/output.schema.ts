// apps/server/src/modules/ai/agents/reports/output.schema.ts
//
// Output schema for Reports Agent

import { z } from 'zod';

const healthIndicatorEnum = z.enum(['GREEN', 'AMBER', 'RED', 'UNKNOWN']);

export const reportsOutputSchema = z.object({
  reportType: z.string().describe('Type of report generated (e.g., "Health Report", "Executive Summary")'),
  asOf: z.string().describe('Timestamp when the report was generated'),
  summary: z.string().max(500).describe('Brief overview of report findings (1-2 sentences)'),
  keyFindings: z.array(z.string()).min(1).max(5).describe('3-5 key findings with specific metrics'),
  insights: z.string().describe('Interpretation of what the data means'),
  recommendations: z.array(z.string()).optional().describe('Action items or areas needing attention'),
  healthIndicators: z.object({
    scheduleHealth: healthIndicatorEnum.optional(),
    budgetHealth: healthIndicatorEnum.optional(),
    overallHealth: healthIndicatorEnum.optional(),
  }).optional().describe('Health status indicators if applicable'),
  metrics: z.object({
    schedulePerformanceIndex: z.number().optional().describe('SPI: >1.0 ahead, <1.0 behind'),
    costPerformanceIndex: z.number().optional().describe('CPI: >1.0 under budget, <1.0 over budget'),
  }).optional().describe('Performance indices if applicable'),
  reportData: z.unknown().describe('Full report data from the tool'),
  citations: z.array(
    z.object({
      toolName: z.string(),
      section: z.string().describe('Which section of the report this data came from'),
    }),
  ).describe('Tool calls made to generate this report'),
});

export type ReportsOutput = z.infer<typeof reportsOutputSchema>;
