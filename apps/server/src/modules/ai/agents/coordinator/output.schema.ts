// apps/server/src/modules/ai/agents/coordinator/output.schema.ts
//
// Output schema for Coordinator Agent
// Records which agent was selected and the routed response

import { z } from 'zod';

export const coordinatorOutputSchema = z.object({
  routedTo: z.object({
    agent: z.string().describe('The specialized agent that was selected'),
    reason: z.string().describe('Brief explanation of why this agent was selected (1-2 sentences)'),
  }),
  response: z.object({
    summary: z.string().max(500).describe('Brief summary of the specialized agent response'),
    details: z.unknown().describe('Full response from the specialized agent'),
  }),
  metadata: z.object({
    subRunId: z.string().describe('The run ID of the sub-run that was created'),
    subRunStatus: z.enum(['SUCCEEDED', 'FAILED', 'CANCELLED']).describe('Status of the sub-run'),
    subRunError: z.string().optional().describe('Error message if sub-run failed'),
  }),
});

export type CoordinatorOutput = z.infer<typeof coordinatorOutputSchema>;
