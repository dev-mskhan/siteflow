// packages/shared/src/modules/project/issue.schema.ts
import { z } from 'zod';

export const ISSUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(4000).optional(),
  reportedImpactDays: z.number().int().min(0).optional().default(0),
  assignedTo: z.string().optional(),
});

export const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(4000).optional(),
  reportedImpactDays: z.number().int().min(0).optional(),
  approvedImpactDays: z.number().int().min(0).optional(),
  assignedTo: z.string().nullable().optional(),
});

export const transitionIssueSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type TransitionIssueInput = z.infer<typeof transitionIssueSchema>;
