// apps/server/src/modules/organization/profile/profile.validation.ts
import { z } from 'zod';

const BUSINESS_TYPES = [
  'GENERAL_CONTRACTOR',
  'SUBCONTRACTOR',
  'SPECIALTY_CONTRACTOR',
  'DESIGN_BUILD',
  'DEVELOPER',
  'CONSULTANT',
  'OTHER',
] as const;

export const updateProfileSchema = z.object({
  legalName: z.string().min(1).max(200).nullable().optional(),
  businessName: z.string().min(1).max(200).nullable().optional(),
  businessType: z.enum(BUSINESS_TYPES).nullable().optional(),
  registrationNumber: z.string().min(1).max(100).nullable().optional(),
  taxIdentificationNumber: z.string().min(1).max(100).nullable().optional(),
  primaryEmail: z.string().email('Invalid primary email address').nullable().optional(),
  primaryPhone: z.string().min(1).max(50).nullable().optional(),
  secondaryPhone: z.string().min(1).max(50).nullable().optional(),
  website: z.string().url('Invalid website URL').nullable().optional(),
  addressLine1: z.string().min(1).max(255).nullable().optional(),
  addressLine2: z.string().min(1).max(255).nullable().optional(),
  city: z.string().min(1).max(100).nullable().optional(),
  stateProvince: z.string().min(1).max(100).nullable().optional(),
  postalCode: z.string().min(1).max(20).nullable().optional(),
  country: z
    .string()
    .length(2, 'Country must be a 2-letter ISO 3166-1 alpha-2 code')
    .regex(/^[A-Z]{2}$/, 'Country code must be 2 uppercase letters (e.g. "US", "GB")')
    .nullable()
    .optional(),
});
