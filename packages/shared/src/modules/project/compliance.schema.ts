import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});

const optionalText = (max = 5000) => z.string().trim().max(max).nullable().optional();
const memberId = z.string().min(1).max(128).nullable().optional();

export const createPermitSchema = z.object({
  permitType: z.string().trim().min(1).max(255),
  referenceNumber: optionalText(255),
  issuingAuthority: optionalText(255),
  responsibleMemberId: memberId,
  issueDate: dateSchema.nullable().optional(),
  effectiveDate: dateSchema.nullable().optional(),
  expiryDate: dateSchema.nullable().optional(),
  notes: optionalText(),
});

export const updatePermitSchema = createPermitSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const permitTransitionSchema = z.object({
  status: z.enum(['APPLIED', 'ISSUED', 'ACTIVE', 'REVOKED', 'CANCELLED']),
});

export const createComplianceInspectionSchema = z.object({
  permitId: z.string().min(1).max(128).nullable().optional(),
  inspectionType: z.string().trim().min(1).max(255),
  scheduledDate: dateSchema.nullable().optional(),
  inspectorName: optionalText(255),
  responsibleMemberId: memberId,
  notes: optionalText(),
});

export const updateComplianceInspectionSchema = createComplianceInspectionSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const completeComplianceInspectionSchema = z.object({
  result: z.enum(['PASS', 'PASS_WITH_CONDITIONS', 'FAIL', 'INCONCLUSIVE']),
  findings: optionalText(),
  performedDate: dateSchema,
});

const complianceRecordShape = {
  requirementType: z.string().trim().min(1).max(255),
  subjectType: z.enum(['SUBCONTRACTOR', 'PROJECT', 'ORGANIZATION']).nullable().optional(),
  subjectId: z.string().min(1).max(128).nullable().optional(),
  responsibleMemberId: memberId,
  effectiveDate: dateSchema.nullable().optional(),
  expiryDate: dateSchema.nullable().optional(),
  verificationRef: optionalText(500),
  notes: optionalText(),
};

const subjectPairRefinement = (
  value: { subjectType?: string | null; subjectId?: string | null },
) =>
  (value.subjectType === undefined) === (value.subjectId === undefined)
    || value.subjectType === null
    || value.subjectId === null;

export const createComplianceRecordSchema = z.object(complianceRecordShape)
  .refine(subjectPairRefinement, 'subjectType and subjectId must be provided together');

export const updateComplianceRecordSchema = z.object({
  ...complianceRecordShape,
  status: z.enum(['ACTIVE']).optional(),
}).partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided')
  .refine(subjectPairRefinement, 'subjectType and subjectId must be provided together');

export const verifyComplianceRecordSchema = z.object({
  verificationRef: z.string().trim().max(500).optional(),
});

export const listComplianceQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().min(1).max(64).optional(),
});

export const listPermitsQuerySchema = listComplianceQuerySchema.extend({
  status: z.enum(['PENDING', 'APPLIED', 'ISSUED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'CANCELLED']).optional(),
});
export const listComplianceInspectionsQuerySchema = listComplianceQuerySchema.extend({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED']).optional(),
});
export const listComplianceRecordsQuerySchema = listComplianceQuerySchema.extend({
  status: z.enum(['PENDING', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED', 'VERIFIED']).optional(),
});

export const listExpiringItemsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  entityType: z.enum(['document', 'permit', 'compliance_record']).optional(),
});

export type CreatePermitInput = z.infer<typeof createPermitSchema>;
export type UpdatePermitInput = z.infer<typeof updatePermitSchema>;
export type CreateComplianceInspectionInput = z.infer<typeof createComplianceInspectionSchema>;
export type UpdateComplianceInspectionInput = z.infer<typeof updateComplianceInspectionSchema>;
export type CreateComplianceRecordInput = z.infer<typeof createComplianceRecordSchema>;
export type UpdateComplianceRecordInput = z.infer<typeof updateComplianceRecordSchema>;
export type ListComplianceQuery = z.infer<typeof listComplianceQuerySchema>;
export type ListExpiringItemsQuery = z.infer<typeof listExpiringItemsQuerySchema>;
