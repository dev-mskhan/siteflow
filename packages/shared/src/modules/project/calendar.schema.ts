// packages/shared/src/modules/project/calendar.schema.ts
import { z } from 'zod';

export const workDaysConfigSchema = z.object({
  monday: z.boolean(),
  tuesday: z.boolean(),
  wednesday: z.boolean(),
  thursday: z.boolean(),
  friday: z.boolean(),
  saturday: z.boolean(),
  sunday: z.boolean(),
});

export const updateCalendarSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  workDays: workDaysConfigSchema.optional(),
  hoursPerDay: z.number().min(0.5).max(24).optional(),
});

export const addCalendarExceptionSchema = z.object({
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  isWorkingDay: z.boolean(),
  name: z.string().trim().min(1).max(255),
});

export type UpdateCalendarInput = z.infer<typeof updateCalendarSchema>;
export type AddCalendarExceptionInput = z.infer<typeof addCalendarExceptionSchema>;
