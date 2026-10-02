// packages/shared/src/modules/project/task.schema.ts
import { z } from 'zod';

export const TASK_TYPES = ['TASK', 'MILESTONE', 'SUMMARY'] as const;
export const TASK_STATUSES = ['NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'] as const;
export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export const CONSTRAINT_TYPES = ['ASAP', 'START_NO_EARLIER_THAN', 'FINISH_NO_LATER_THAN'] as const;

export const createTaskSchema = z.object({
  taskCode: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1, 'Task name is required').max(255),
  description: z.string().trim().max(2000).optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  phaseId: z.string().trim().optional(),
  parentTaskId: z.string().trim().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  constraintType: z.enum(CONSTRAINT_TYPES).optional(),
  constraintDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  assignedTo: z.string().trim().optional(),
  subcontractorId: z.string().trim().optional(),
  currentStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  currentFinishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  currentDurationDays: z.number().int().min(0).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
});

export const updateTaskSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  phaseId: z.string().trim().nullable().optional(),
  parentTaskId: z.string().trim().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  constraintType: z.enum(CONSTRAINT_TYPES).optional(),
  constraintDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  assignedTo: z.string().trim().nullable().optional(),
  subcontractorId: z.string().trim().nullable().optional(),
  currentStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  currentFinishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  currentDurationDays: z.number().int().min(0).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  expectedVersion: z.number().int().min(1, 'expectedVersion is required'),
});

export const transitionTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  expectedVersion: z.number().int().min(1, 'expectedVersion is required'),
});

export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  phaseId: z.string().trim().optional(),
  parentTaskId: z.string().trim().nullable().optional(),
  assignedTo: z.string().trim().optional(),
  isCritical: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  search: z.string().trim().optional(),
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TransitionTaskStatusInput = z.infer<typeof transitionTaskStatusSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
