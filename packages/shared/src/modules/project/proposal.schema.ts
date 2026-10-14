import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────
const id = z.string().trim().min(1).max(128);
const title = z.string().trim().min(1).max(160);
const money = z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/);
const quantity = z.string().regex(/^\d{1,12}(?:\.\d{1,3})?$/);
const percentage = z
  .string()
  .regex(/^(?:100(?:\.0{1,4})?|(?:\d{1,2})(?:\.\d{1,4})?)$/);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const expectedVersion = z.number().int().positive();

// ── Proposal line (immutable snapshot of a BOQ / estimate item) ──────────────
const proposalLineSchema = z
  .object({
    sortOrder: z.number().int().positive(),
    itemKey: z.string().trim().min(1).max(64),
    sectionKey: z.string().trim().min(1).max(64).nullable().optional(),
    description: z.string().trim().min(1).max(500),
    specification: z.string().trim().max(2000).nullable().optional(),
    unit: z.string().trim().min(1).max(32),
    quantity,
    unitRate: money,
    amount: money,
    currency: currencyCode,
    costCodeId: id.nullable().optional(),
  })
  .strict();

// ── Commercial terms ─────────────────────────────────────────────────────────
const commercialTermsSchema = z
  .object({
    paymentTerms: z.string().trim().max(1000).nullable().optional(),
    retentionPercent: percentage.default('0'),
    liquidatedDamages: z.string().trim().max(1000).nullable().optional(),
    bondRequirements: z.string().trim().max(1000).nullable().optional(),
    insuranceRequirements: z.string().trim().max(1000).nullable().optional(),
    otherTerms: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

// ── Proposal draft fields (used for both create and update) ──────────────────
const proposalDraftFields = z.object({
  title,
  description: z.string().trim().max(5000).nullable().optional(),
  tenderId: id.nullable().optional(),
  clientName: z.string().trim().max(200).nullable().optional(),
  clientReference: z.string().trim().max(200).nullable().optional(),
  scope: z.string().trim().max(5000).nullable().optional(),
  inclusions: z.string().trim().max(5000).nullable().optional(),
  exclusions: z.string().trim().max(5000).nullable().optional(),
  assumptions: z.string().trim().max(5000).nullable().optional(),
  clarifications: z.string().trim().max(5000).nullable().optional(),
  sourceEstimateId: id.nullable().optional(),
  sourceEstimateRevisionId: id.nullable().optional(),
  sourceBoqId: id.nullable().optional(),
  sourceBoqRevisionId: id.nullable().optional(),
  currencyCode,
  taxPercent: percentage.default('0'),
  taxSource: z.string().trim().max(500).nullable().optional(),
  overheadPercent: percentage.default('0'),
  contingencyPercent: percentage.default('0'),
  markupPercent: percentage.default('0'),
  discountPercent: percentage.default('0'),
  totalAmount: money.nullable().optional(),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use ISO date format YYYY-MM-DD')
    .nullable()
    .optional(),
  estimatedDurationDays: z.number().int().positive().max(9999).nullable().optional(),
  scheduleSummary: z.string().trim().max(2000).nullable().optional(),
  commercialTerms: commercialTermsSchema.nullable().optional(),
  lines: z.array(proposalLineSchema).min(0).max(1000),
});

const enforceTaxSource = (
  input: { taxPercent?: string; taxSource?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (Number(input.taxPercent ?? '0') > 0 && !input.taxSource?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['taxSource'],
      message: 'Provide the tax basis/source when tax percent is greater than zero.',
    });
  }
};

const enforceSourcePresence = (
  input: {
    sourceEstimateId?: string | null;
    sourceEstimateRevisionId?: string | null;
    sourceBoqId?: string | null;
    sourceBoqRevisionId?: string | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (input.sourceEstimateId && !input.sourceEstimateRevisionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceEstimateRevisionId'],
      message: 'A specific estimate revision ID is required when sourceEstimateId is set.',
    });
  }
  if (input.sourceBoqId && !input.sourceBoqRevisionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceBoqRevisionId'],
      message: 'A specific BOQ revision ID is required when sourceBoqId is set.',
    });
  }
};

// ── Proposal create ───────────────────────────────────────────────────────────
export const createProposalSchema = proposalDraftFields
  .strict()
  .superRefine(enforceTaxSource)
  .superRefine(enforceSourcePresence);

// ── Proposal update ───────────────────────────────────────────────────────────
export const updateProposalSchema = proposalDraftFields
  .extend({ expectedVersion })
  .strict()
  .superRefine(enforceTaxSource)
  .superRefine(enforceSourcePresence);

// ── Lifecycle transitions ─────────────────────────────────────────────────────
export const transitionProposalSchema = z
  .object({ expectedVersion })
  .strict();

export const rejectProposalSchema = transitionProposalSchema
  .extend({ reason: z.string().trim().min(10).max(500) })
  .strict();

export const withdrawProposalSchema = transitionProposalSchema
  .extend({ reason: z.string().trim().min(1).max(500) })
  .strict();

// ── Issue (publish immutable revision + artifact) ────────────────────────────
export const issueProposalSchema = z
  .object({
    expectedVersion,
    deliveryMethod: z.enum(['INTERNAL', 'EMAIL']).default('INTERNAL'),
    deliveryNotes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

// ── Record client response ────────────────────────────────────────────────────
export const recordClientResponseSchema = z
  .object({
    expectedVersion,
    event: z.enum(['ACCEPTED', 'REJECTED']),
    clientSignatoryName: z.string().trim().max(200).nullable().optional(),
    responseReference: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

// ── Convert accepted proposal → project (idempotent) ─────────────────────────
export const convertProposalSchema = z
  .object({
    expectedVersion,
    idempotencyKey: z.string().trim().min(1).max(255),
    projectName: z.string().trim().min(1).max(160),
    projectType: z
      .enum(['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER'])
      .nullable()
      .optional(),
    plannedStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use ISO date format YYYY-MM-DD')
      .nullable()
      .optional(),
  })
  .strict();

// ── Tender opportunity create / update ────────────────────────────────────────
export const createTenderSchema = z
  .object({
    title,
    description: z.string().trim().max(5000).nullable().optional(),
    clientName: z.string().trim().min(1).max(200),
    clientReference: z.string().trim().max(200).nullable().optional(),
    issuerName: z.string().trim().max(200).nullable().optional(),
    projectId: id.nullable().optional(),
    submissionDeadline: z.string().datetime({ offset: true }),
    submissionTimezone: z.string().trim().min(1).max(100),
    requirements: z.string().trim().max(5000).nullable().optional(),
    requiredDocuments: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    estimatedValue: money.nullable().optional(),
    currencyCode: currencyCode.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const updateTenderSchema = createTenderSchema
  .extend({ expectedVersion })
  .strict();

// ── Route params / query schemas ──────────────────────────────────────────────
export const proposalParamsSchema = z
  .object({
    organizationId: id,
    projectId: id,
    proposalId: id.optional(),
    revisionId: id.optional(),
    tenderId: id.optional(),
  })
  .strict();

export const tenderParamsSchema = z
  .object({
    organizationId: id,
    tenderId: id.optional(),
  })
  .strict();

export const proposalListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(256).optional(),
    status: z
      .enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'])
      .optional(),
    tenderId: id.optional(),
  })
  .strict();

export const tenderListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(256).optional(),
    status: z
      .enum(['OPEN', 'SUBMITTED', 'AWARDED', 'LOST', 'WITHDRAWN', 'EXPIRED'])
      .optional(),
  })
  .strict();

export const proposalRevisionListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(256).optional(),
  })
  .strict();

// ── Type exports ──────────────────────────────────────────────────────────────
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type TransitionProposalInput = z.infer<typeof transitionProposalSchema>;
export type RejectProposalInput = z.infer<typeof rejectProposalSchema>;
export type WithdrawProposalInput = z.infer<typeof withdrawProposalSchema>;
export type IssueProposalInput = z.infer<typeof issueProposalSchema>;
export type RecordClientResponseInput = z.infer<typeof recordClientResponseSchema>;
export type ConvertProposalInput = z.infer<typeof convertProposalSchema>;
export type CreateTenderInput = z.infer<typeof createTenderSchema>;
export type UpdateTenderInput = z.infer<typeof updateTenderSchema>;
