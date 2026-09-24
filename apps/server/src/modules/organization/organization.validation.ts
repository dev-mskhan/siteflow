// apps/server/src/modules/organization/organization.validation.ts
import { z } from 'zod';

export const orgSettingsSchema = z.object({
  timezone: z.string().default('UTC'),
  locale: z.string().default('en-US'),
  currency: z.string().default('USD'),
  dateFormat: z.string().default('YYYY-MM-DD'),
});

// ISO 3166-1 alpha-2: exactly 2 uppercase letters
const countryCodeSchema = z
  .string()
  .length(2, 'Country must be a 2-letter ISO 3166-1 alpha-2 code')
  .regex(/^[A-Z]{2}$/, 'Country code must be 2 uppercase letters (e.g. "US", "GB")')
  .optional();

export const createOrgSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  country: countryCodeSchema,
  settings: orgSettingsSchema.partial().optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  country: countryCodeSchema,
  settings: orgSettingsSchema.partial().optional(),
});

export const updateSettingsSchema = orgSettingsSchema.partial();
