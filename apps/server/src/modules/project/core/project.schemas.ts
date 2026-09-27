// apps/server/src/modules/project/core/project.schemas.ts
// Zod input validation schemas for the project module.
import { z } from 'zod';

const PROJECT_TYPES = ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER'] as const;
const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'] as const;

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  projectType: z.enum(PROJECT_TYPES).optional(),
  contractValue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Contract value must be a valid decimal number')
    .optional(),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-character ISO code')
    .toUpperCase()
    .optional(),
  plannedStartDate: z.string().date('Invalid date format, expected YYYY-MM-DD').optional(),
  plannedEndDate: z.string().date('Invalid date format, expected YYYY-MM-DD').optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    projectType: z.enum(PROJECT_TYPES).nullable().optional(),
    contractValue: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .nullable()
      .optional(),
    plannedStartDate: z.string().date().nullable().optional(),
    plannedEndDate: z.string().date().nullable().optional(),
    // status must NOT be present — lifecycle endpoints handle status
    expectedVersion: z.number().int().positive('expectedVersion is required'),
  })
  .strict(); // reject any extra keys (including status)

export const listProjectsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(PROJECT_STATUSES).optional(),
  search: z.string().max(200).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
