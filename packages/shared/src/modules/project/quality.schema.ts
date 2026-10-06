import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const nullableText = (max = 5000) => z.string().trim().max(max).nullable().optional();
const memberId = z.string().min(1).max(128).nullable().optional();

export const createQualityInspectionSchema = z.object({
  inspectionType: z.string().trim().min(1).max(255),
  scheduledDate: dateSchema.nullable().optional(),
  inspectorMemberId: memberId,
  location: nullableText(500),
  notes: nullableText(),
});
export const updateQualityInspectionSchema = z.object({
  inspectionType: z.string().trim().min(1).max(255).optional(),
  scheduledDate: dateSchema.nullable().optional(),
  inspectorMemberId: memberId,
  location: nullableText(500),
  notes: nullableText(),
  status: z.enum(['IN_PROGRESS', 'CANCELLED']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');
export const completeQualityInspectionSchema = z.object({
  result: z.enum(['PASS', 'PASS_WITH_CONDITIONS', 'FAIL']),
  findings: nullableText(),
  performedDate: dateSchema,
});
export const listQualityInspectionsQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

export const createQualityDeficiencySchema = z.object({
  inspectionId: z.string().min(1).max(128).nullable().optional(),
  title: z.string().trim().min(1).max(500),
  description: nullableText(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  responsibleMemberId: memberId,
  dueDate: dateSchema.nullable().optional(),
  location: nullableText(500),
  notes: nullableText(),
});
export const updateQualityDeficiencySchema = z.object({
  inspectionId: z.string().min(1).max(128).nullable().optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: nullableText(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  responsibleMemberId: memberId,
  dueDate: dateSchema.nullable().optional(),
  location: nullableText(500),
  notes: nullableText(),
  status: z.enum(['IN_PROGRESS', 'DISPUTED', 'CANCELLED']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');
export const listQualityDeficienciesQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DISPUTED', 'CANCELLED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  inspectionId: z.string().min(1).max(128).optional(),
});

export const createCorrectiveActionSchema = z.object({
  sourceType: z.enum(['QUALITY_DEFICIENCY', 'SAFETY_INCIDENT', 'SAFETY_OBSERVATION']),
  sourceId: z.string().min(1).max(128),
  title: z.string().trim().min(1).max(500),
  description: nullableText(),
  assignedTo: z.string().min(1).max(128).nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  notes: nullableText(),
});
export const updateCorrectiveActionSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: nullableText(),
  assignedTo: z.string().min(1).max(128).nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  notes: nullableText(),
  status: z.enum(['IN_PROGRESS', 'CANCELLED']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');
export const completeCorrectiveActionSchema = z.object({}).default({});
export const verifyCorrectiveActionSchema = z.object({ notes: nullableText() });
export const listCorrectiveActionsQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED']).optional(),
  sourceType: z.enum(['QUALITY_DEFICIENCY', 'SAFETY_INCIDENT', 'SAFETY_OBSERVATION']).optional(),
  sourceId: z.string().min(1).max(128).optional(),
});

export type CreateQualityInspectionInput = z.infer<typeof createQualityInspectionSchema>;
export type UpdateQualityInspectionInput = z.infer<typeof updateQualityInspectionSchema>;
export type CompleteQualityInspectionInput = z.infer<typeof completeQualityInspectionSchema>;
export type CreateQualityDeficiencyInput = z.infer<typeof createQualityDeficiencySchema>;
export type UpdateQualityDeficiencyInput = z.infer<typeof updateQualityDeficiencySchema>;
export type CreateCorrectiveActionInput = z.infer<typeof createCorrectiveActionSchema>;
export type UpdateCorrectiveActionInput = z.infer<typeof updateCorrectiveActionSchema>;
export type CompleteCorrectiveActionInput = z.infer<typeof completeCorrectiveActionSchema>;
export type VerifyCorrectiveActionInput = z.infer<typeof verifyCorrectiveActionSchema>;
export type ListQualityInspectionsQuery = z.infer<typeof listQualityInspectionsQuerySchema>;
export type ListQualityDeficienciesQuery = z.infer<typeof listQualityDeficienciesQuerySchema>;
export type ListCorrectiveActionsQuery = z.infer<typeof listCorrectiveActionsQuerySchema>;
