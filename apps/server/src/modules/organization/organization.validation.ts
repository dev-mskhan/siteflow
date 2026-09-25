// apps/server/src/modules/organization/organization.validation.ts
import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
});
