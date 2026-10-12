/**
 * Shared form validation utilities using Zod
 */

import { z, ZodError } from 'zod';

export type FormErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Validates form data against a Zod schema and returns clean field-level error messages
 */
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: FormErrors<T> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: FormErrors<T> = {};
  if (result.error instanceof ZodError) {
    result.error.issues.forEach((issue: z.ZodIssue) => {
      const field = issue.path[0] as keyof T;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    });
  }

  return { success: false, errors };
}
