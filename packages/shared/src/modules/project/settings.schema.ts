// packages/shared/src/modules/project/settings.schema.ts
import { z } from 'zod';

export const DATE_FORMATS = ['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD'] as const;
export const TIME_FORMATS = ['H12', 'H24'] as const;
export const UNIT_SYSTEMS = ['METRIC', 'IMPERIAL'] as const;

export const updateProjectSettingsSchema = z.object({
  timezone: z.string().min(1).max(100).optional(),
  locale: z.string().min(2).max(20).optional(),
  dateFormat: z.enum(DATE_FORMATS).optional(),
  timeFormat: z.enum(TIME_FORMATS).optional(),
  unitSystem: z.enum(UNIT_SYSTEMS).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
});

export type UpdateProjectSettingsInput = z.infer<typeof updateProjectSettingsSchema>;
