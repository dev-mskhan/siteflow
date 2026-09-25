// apps/server/src/modules/organization/settings/settings.validation.ts
import { z } from 'zod';

export const updateSettingsSchema = z.object({
  timezone: z
    .string()
    .refine(
      (val) => {
        try {
          return Intl.supportedValuesOf('timeZone').includes(val);
        } catch {
          // Fallback: try constructing Intl.DateTimeFormat — throws if invalid
          try {
            Intl.DateTimeFormat(undefined, { timeZone: val });
            return true;
          } catch {
            return false;
          }
        }
      },
      { message: 'Invalid IANA timezone identifier' },
    )
    .optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Currency must be exactly 3 uppercase letters (e.g. "USD", "EUR")')
    .optional(),
  locale: z.string().min(1, 'Locale must not be empty').optional(),
  dateFormat: z.enum(['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD']).optional(),
  timeFormat: z.enum(['H12', 'H24']).optional(),
  unitSystem: z.enum(['METRIC', 'IMPERIAL']).optional(),
  weekStartsOn: z
    .number()
    .int()
    .min(0, 'weekStartsOn must be between 0 and 6')
    .max(6, 'weekStartsOn must be between 0 and 6')
    .optional(),
  fiscalYearStartMonth: z
    .number()
    .int()
    .min(1, 'fiscalYearStartMonth must be between 1 and 12')
    .max(12, 'fiscalYearStartMonth must be between 1 and 12')
    .optional(),
});
