/**
 * Pre-construction types — Group 7
 * Mirrors server DTOs exactly.
 *
 * Sources:
 *   Tender / Proposal: apps/server/src/modules/project/proposal/proposal.service.ts
 *   Estimate:          apps/server/src/modules/project/estimate/estimate.service.ts
 *   BOQ:               apps/server/src/modules/project/boq/boq.service.ts
 *   Takeoff:           apps/server/src/modules/project/takeoff/takeoff.service.ts
 *   Pricing:           apps/server/src/modules/project/pricing/pricing.service.ts
 *
 * Validation schemas (authoritative):
 *   packages/shared/src/modules/project/proposal.schema.ts
 *   packages/shared/src/modules/project/estimate.schema.ts
 *   packages/shared/src/modules/project/boq.schema.ts
 *   packages/shared/src/modules/project/takeoff.schema.ts
 *   packages/shared/src/modules/project/pricing.schema.ts
 */

// ── Tender ────────────────────────────────────────────────────────────────────

export type TenderStatus = 'OPEN' | 'SUBMITTED' | 'AWARDED' | 'LOST' | 'WITHDRAWN' | 'EXPIRED';

export interface TenderDTO {
  id: string;
  organizationId: string;
  projectId: string | null;
  tenderNumber: string;
  title: string;
  description: string | null;
  clientName: string;
  clientReference: string | null;
  issuerName: string | null;
  status: TenderStatus;
  submissionDeadline: string;       // ISO datetime
  submissionTimezone: string;
  requirements: string | null;
  requiredDocuments: string[] | null;
  estimatedValue: string | null;    // decimal string
  currencyCode: string | null;
  notes: string | null;
  version: number;
  createdBy: string;
  submittedAt: string | null;
  awardedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenderInput {
  title: string;                    // min:1 max:160
  description?: string;             // max:5000
  clientName: string;               // min:1 max:200
  clientReference?: string;         // max:200
  issuerName?: string;              // max:200
  projectId?: string;
  submissionDeadline: string;       // ISO datetime with offset
  submissionTimezone: string;       // min:1 max:100
  requirements?: string;            // max:5000
  requiredDocuments?: string[];     // max:50 items, each max:200
  estimatedValue?: string;          // decimal pattern
  currencyCode?: string;            // 3-char uppercase
  notes?: string;                   // max:2000
  expectedVersion?: number;         // required on update only
}

export interface UpdateTenderInput {
  title?: string;
  description?: string;
  clientReference?: string;
  issuerName?: string;
  submissionDeadline?: string;
  submissionTimezone?: string;
  requirements?: string;
  requiredDocuments?: string[];
  estimatedValue?: string;
  currencyCode?: string;
  notes?: string;
  expectedVersion: number;
}

export interface TenderTransitionInput {
  expectedVersion: number;
  notes?: string;
}

export interface AwardTenderInput extends TenderTransitionInput {
  projectId?: string;
}

// ── Proposal ─────────────────────────────────────────────────────────────────

export type ProposalStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ISSUED'
  | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED';

export interface ProposalLineDTO {
  id: string;
  sortOrder: number;
  itemKey: string;
  sectionKey: string | null;
  description: string;
  specification: string | null;
  unit: string;
  quantity: string;
  unitRate: string;
  amount: string;
  currency: string;
  costCodeId: string | null;
}

export interface ProposalRevisionDTO {
  id: string;
  proposalId: string;
  revisionNumber: number;
  status: string;
  currencyCode: string;
  taxPercent: string;
  taxSource: string | null;
  overheadPercent: string;
  contingencyPercent: string;
  markupPercent: string;
  discountPercent: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  scope: string | null;
  inclusions: string | null;
  exclusions: string | null;
  assumptions: string | null;
  validUntil: string | null;
  estimatedDurationDays: number | null;
  createdBy: string;
  submittedBy: string | null;
  approvedBy: string | null;
  issuedBy: string | null;
  deliveryMethod: string;
  createdAt: string;
}

export interface ProposalDTO {
  id: string;
  organizationId: string;
  projectId: string;
  tenderId: string | null;
  proposalNumber: string;
  title: string;
  description: string | null;
  status: ProposalStatus;
  currentRevisionNumber: number;
  version: number;
  clientName: string | null;
  clientReference: string | null;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
  withdrawnBy: string | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  revision: ProposalRevisionDTO;
  lines: ProposalLineDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalInput {
  title: string;
  description?: string;
  tenderId?: string;
  clientName?: string;
  clientReference?: string;
  scope?: string;
  inclusions?: string;
  exclusions?: string;
  assumptions?: string;
  clarifications?: string;
  currencyCode: string;              // 3-char uppercase
  taxPercent?: string;               // default '0'
  taxSource?: string;                // required when taxPercent > 0
  overheadPercent?: string;
  contingencyPercent?: string;
  markupPercent?: string;
  discountPercent?: string;
  validUntil?: string;               // YYYY-MM-DD
  estimatedDurationDays?: number;
  scheduleSummary?: string;
  commercialTerms?: {
    paymentTerms?: string;
    retentionPercent?: string;
    liquidatedDamages?: string;
    bondRequirements?: string;
    insuranceRequirements?: string;
    otherTerms?: string;
  };
  totalAmount?: string;
  lines: ProposalLineInput[];
  expectedVersion?: number;          // required on update
}

export interface ProposalLineInput {
  sortOrder: number;
  itemKey: string;
  sectionKey?: string;
  description: string;
  specification?: string;
  unit: string;
  quantity: string;
  unitRate: string;
  amount: string;
  currency: string;
  costCodeId?: string;
}

export interface ProposalTransitionInput {
  expectedVersion: number;
  notes?: string;
}

export interface UpdateProposalInput extends CreateProposalInput {
  expectedVersion: number;
}

export interface RejectProposalInput extends ProposalTransitionInput {
  reason: string;
}

export interface IssueProposalInput extends ProposalTransitionInput {
  deliveryMethod: 'EMAIL' | 'PORTAL' | 'MANUAL';
  recipientEmails?: string[];
}

export interface RecordClientResponseInput extends ProposalTransitionInput {
  responseType: 'ACCEPTED' | 'REJECTED' | 'NEGOTIATION';
  feedback?: string;
}

export interface ConvertProposalInput extends ProposalTransitionInput {
  targetType: 'PROJECT' | 'CHANGE_ORDER';
}

// ── Estimate ──────────────────────────────────────────────────────────────────

export type EstimateStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type EstimateCategory = 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'OTHER';

export interface EstimateResourceDTO {
  id: string;
  category: EstimateCategory;
  description: string;
  unit: string;
  quantityPerLineUnit: string;
  unitRate: string;
  wastePercent: string;
  extendedAmount: string;
  rateSource: string | null;
}

export interface EstimateLineDTO {
  id: string;
  costCodeId: string | null;
  lineNumber: number;
  category: EstimateCategory;
  description: string;
  specification: string | null;
  quantity: string;
  unit: string;
  unitRate: string | null;
  directAmount: string;
  resources: EstimateResourceDTO[];
}

export interface EstimateSectionDTO {
  id: string;
  sectionNumber: number;
  title: string;
  description: string | null;
  lines: EstimateLineDTO[];
}

export interface EstimateRevisionDTO {
  id: string;
  revisionNumber: number;
  status: string;
  currencyCode: string;
  overheadPercent: string;
  contingencyPercent: string;
  markupMode: string;
  markupPercent: string;
  discountPercent: string;
  taxPercent: string;
  taxSource: string | null;
  directCostTotal: string;
  overheadAmount: string;
  contingencyAmount: string;
  markupAmount: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  totalAmount: string;
  createdBy: string;
  submittedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
}

export interface EstimateDTO {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: EstimateStatus;
  currentRevisionNumber: number;
  version: number;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  revision: EstimateRevisionDTO;
  sections: EstimateSectionDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface EstimateResourceInput {
  category: EstimateCategory;
  description: string;           // min:1 max:500
  unit: string;                  // min:1 max:32
  quantityPerLineUnit: string;   // decimal
  unitRate: string;              // money
  wastePercent?: string;         // default '0'
  rateSource?: string;           // max:500
}

export interface EstimateLineInput {
  category: EstimateCategory;
  description: string;           // min:1 max:500
  specification?: string;        // max:2000
  costCodeId?: string;
  quantity: string;              // decimal > 0
  unit: string;                  // min:1 max:32
  unitRate?: string;             // money — either unitRate OR resources, not both
  resources?: EstimateResourceInput[];
}

export interface EstimateSectionInput {
  title: string;                 // min:1 max:160
  description?: string;          // max:2000
  lines: EstimateLineInput[];    // min:1 max:500
}

export interface CreateEstimateInput {
  title: string;                 // min:1 max:160
  description?: string;          // max:5000
  terms: {
    overheadPercent?: string;
    contingencyPercent?: string;
    markupMode?: 'NONE' | 'MARKUP' | 'TARGET_MARGIN';
    markupPercent?: string;
    discountPercent?: string;
    taxPercent?: string;
    taxSource?: string;
  };
  sections: EstimateSectionInput[];
  expectedVersion?: number;      // required on update
}

// ── BOQ ───────────────────────────────────────────────────────────────────────

export type BoqStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'LOCKED';

export interface BoqItemDTO {
  id: string;
  itemKey: string;
  sortOrder: number;
  description: string;
  specification: string | null;
  unit: string;
  quantity: string;
  unitRate: string | null;
  amount: string | null;
  currencyCode: string;
  costCodeId: string | null;
  sectionId: string;
}

export interface BoqSectionDTO {
  id: string;
  sectionKey: string;
  sortOrder: number;
  depth: number;
  title: string;
  parentSectionId: string | null;
}

export interface BoqRevisionDTO {
  id: string;
  boqId: string;
  revisionNumber: number;
  status: string;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  createdAt: string;
}

export interface BoqDTO {
  id: string;
  organizationId: string;
  projectId: string;
  boqNumber: string;
  title: string;
  description: string | null;
  currencyCode: string;
  status: BoqStatus;
  currentRevisionNumber: number;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoqInput {
  title: string;               // min:1 max:160
  description?: string;        // max:5000
  currencyCode: string;        // 3-char uppercase
}

export interface ReviseBoqInput {
  expectedVersion: number;
  reason: string;              // min:10 max:500
}

export interface BoqImportPreviewResult {
  importId: string;
  status: string;
  sourceFileSha256: string;
  rowCount: number;
  sectionCount: number;
  totalAmount: string;
  currencyCode: string;
}

// ── Takeoff ───────────────────────────────────────────────────────────────────

export type TakeoffSheetStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type TakeoffDimension = 'LENGTH' | 'AREA' | 'VOLUME' | 'COUNT';
export type TakeoffMeasurementMode = 'MANUAL' | 'FORMULA';

export interface TakeoffSheetDTO {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TakeoffSheetStatus;
  version: number;
  currentRevisionNumber: number;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TakeoffRevisionDTO {
  id: string;
  sheetId: string;
  revisionNumber: number;
  status: string;
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
}

export interface TakeoffFormulaInputDTO {
  variableName: string;
  value: string;
  unit: string;
  dimension: TakeoffDimension;
}

export interface TakeoffMeasurementDTO {
  id: string;
  revisionId: string;
  sourceId: string | null;
  description: string;
  dimension: TakeoffDimension;
  unit: string;
  measurementMode: TakeoffMeasurementMode;
  manualQuantity: string | null;
  formulaText: string | null;
  deductionQuantity: string;
  wastePercent: string;
  grossQuantity: string;
  resultQuantity: string;
  boqItemId: string | null;
  costCodeId: string | null;
  notes: string | null;
  inputs: TakeoffFormulaInputDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface TakeoffSourceDTO {
  id: string;
  sheetId: string;
  documentId: string;
  documentVersionId: string;
  pageReference: string;
  regionLabel: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateTakeoffSheetInput {
  title: string;               // min:1 max:160
  description?: string;        // max:2000
}

export interface CreateTakeoffMeasurementInput {
  description: string;         // min:1 max:500
  dimension: TakeoffDimension;
  unit: string;                // min:1 max:32
  measurementMode: TakeoffMeasurementMode;
  sourceId?: string;
  manualQuantity?: string;     // required when mode=MANUAL
  formulaText?: string;        // required when mode=FORMULA; max:500
  inputs?: TakeoffFormulaInputDTO[]; // max:20; required for FORMULA
  deductionQuantity?: string;  // default '0'
  wastePercent?: string;       // default '0'
  boqItemId?: string;
  costCodeId?: string;
  notes?: string;              // max:2000
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export type PricingRateStatus = 'DRAFT' | 'APPROVED' | 'RETIRED';
export type PricingRateScope = 'ORGANIZATION' | 'PROJECT';

export interface MaterialRateVersionDTO {
  id: string;
  organizationId: string;
  materialId: string;
  scope: PricingRateScope;
  projectId: string | null;
  versionNumber: number;
  unitCode: string;
  unitPrice: string;            // decimal up to 4 fraction digits
  currencyCode: string;
  effectiveFrom: string;        // YYYY-MM-DD
  effectiveTo: string | null;
  status: PricingRateStatus;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedRateDTO {
  source: 'ACCEPTED_QUOTE' | 'PROJECT_RATE' | 'ORGANIZATION_RATE';
  unitPrice: string;
  unitCode: string;
  currencyCode: string;
  quoteId?: string;
  quoteItemId?: string;
  rateVersion?: MaterialRateVersionDTO;
}

export interface ProposalClientEventDTO {
  id: string;
  proposalId: string;
  proposalRevisionId: string;
  organizationId: string;
  projectId: string;
  event: 'ACCEPTED' | 'REJECTED';
  clientSignatoryName: string | null;
  responseReference: string | null;
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface CreateRateVersionInput {
  materialId: string;
  scope: PricingRateScope;
  projectId?: string;           // required when scope='PROJECT'
  unitCode: string;             // min:1 max:32
  unitPrice: string;            // regex /^\d{1,11}(?:\.\d{1,4})?$/
  currencyCode: string;         // 3-char uppercase
  effectiveFrom: string;        // YYYY-MM-DD
  effectiveTo?: string;         // YYYY-MM-DD; must be after effectiveFrom
}

// ── Estimate Transition Types ────────────────────────────────────────────────

export interface EstimateTransitionInput {
  expectedVersion: number;
  notes?: string;
}

export interface UpdateEstimateInput extends CreateEstimateInput {
  expectedVersion: number;
}

export interface RejectEstimateInput extends EstimateTransitionInput {
  reason: string;
}

export interface EstimateComparisonResult {
  estimateId: string;
  estimate: {
    totalAmount: string;
    directCostTotal: string;
    overheadAmount: string;
    contingencyAmount: string;
  };
  actuals: {
    totalCommitted: string;
    totalSpent: string;
    remainingBudget: string;
  };
  variance: {
    amount: string;
    percent: string;
  };
}

// ── BOQ Transition Types ──────────────────────────────────────────────────────

export interface BoqTransitionInput {
  expectedVersion: number;
  notes?: string;
}

export interface BoqMapItemInput {
  costCodeId?: string;
  materialId?: string;
  taskId?: string;
}

export interface BoqImportCommitInput {
  importKey: string;
  mappings?: Record<string, BoqMapItemInput>;
}
