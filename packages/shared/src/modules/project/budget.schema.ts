import { z } from 'zod';

const decimalMoney = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/);
const budgetLine = z.object({
  costCodeId: z.string().min(1).max(128),
  phaseId: z.string().min(1).max(128).optional(),
  description: z.string().max(500).optional(),
  amount: decimalMoney,
});

export const createProjectBudgetSchema = z.object({
  currencyCode: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  lines: z.array(budgetLine).min(1).max(100),
});

export const updateProjectBudgetSchema = z.object({
  expectedVersion: z.number().int().positive(),
  lines: z.array(budgetLine).min(1).max(100),
});

export const budgetTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const projectBudgetParamsSchema = z.object({
  organizationId: z.string().min(1).max(128),
  projectId: z.string().min(1).max(128),
  budgetId: z.string().min(1).max(128).optional(),
});

export const listProjectBudgetsQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProjectBudgetInput = z.infer<typeof createProjectBudgetSchema>;
export type UpdateProjectBudgetInput = z.infer<typeof updateProjectBudgetSchema>;
