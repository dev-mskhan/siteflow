// apps/server/src/modules/project/issue/issue.schemas.ts
import { z } from 'zod';

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
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});
