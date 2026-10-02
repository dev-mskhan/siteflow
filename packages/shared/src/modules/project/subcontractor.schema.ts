// packages/shared/src/modules/project/subcontractor.schema.ts
import { z } from 'zod';

export const createSubcontractorSchema = z.object({
  legalName: z.string().trim().min(1).max(500),
  displayName: z.string().trim().min(1).max(500),
  trade: z.string().trim().max(200).optional(),
  registrationReference: z.string().trim().max(200).optional(),
  taxReference: z.string().trim().max(200).optional(),
  primaryEmail: z.string().trim().email().max(254).optional(),
  primaryPhone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const updateSubcontractorSchema = z.object({
  legalName: z.string().trim().min(1).max(500).optional(),
  displayName: z.string().trim().min(1).max(500).optional(),
  trade: z.string().trim().max(200).optional(),
  registrationReference: z.string().trim().max(200).optional(),
  taxReference: z.string().trim().max(200).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  primaryEmail: z.string().trim().email().max(254).optional().nullable(),
  primaryPhone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const assignSubcontractorToProjectSchema = z.object({
  subcontractorId: z.string().min(1),
  scopeDescription: z.string().trim().max(2000).optional(),
  contractValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currencyCode: z.string().trim().length(3).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateProjectSubcontractorSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  scopeDescription: z.string().trim().max(2000).optional(),
  contractValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  currencyCode: z.string().trim().length(3).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const createSubcontractorContactSchema = z.object({
  name: z.string().trim().min(1).max(300),
  role: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().max(50).optional(),
  isPrimary: z.boolean().optional().default(false),
});

export const updateSubcontractorContactSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  role: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).optional().nullable(),
  phone: z.string().trim().max(50).optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const assignSubcontractorTaskSchema = z.object({
  taskId: z.string().min(1),
  assignmentRole: z.string().trim().max(200).optional(),
});

export const listSubcontractorsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>;
export type AssignSubcontractorToProjectInput = z.infer<typeof assignSubcontractorToProjectSchema>;
export type UpdateProjectSubcontractorInput = z.infer<typeof updateProjectSubcontractorSchema>;
export type CreateSubcontractorContactInput = z.infer<typeof createSubcontractorContactSchema>;
export type UpdateSubcontractorContactInput = z.infer<typeof updateSubcontractorContactSchema>;
export type AssignSubcontractorTaskInput = z.infer<typeof assignSubcontractorTaskSchema>;
