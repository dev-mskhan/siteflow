/**
 * commercialTypes — Group 8 DTOs mirroring server exactly.
 *
 * Sources:
 *   Change Order:    apps/server/src/modules/project/change-order/
 *   SOV:             apps/server/src/modules/project/schedule-of-values/
 *   Payment App:     apps/server/src/modules/project/payment-application/
 *   Invoice/Payment: apps/server/src/modules/project/invoice-payment/
 *   Retainage:       apps/server/src/modules/project/retainage/
 *   Cost Txn:        apps/server/src/modules/project/cost-transaction/cost-transaction.schemas.ts
 *   Summaries:       apps/server/src/modules/project/commercial-summary/
 *                    apps/server/src/modules/project/financial-summary/
 */

// ── Change Order ──────────────────────────────────────────────────────────────

export type ChangeOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'INTERNALLY_APPROVED'
  | 'CLIENT_APPROVED'
  | 'EFFECTED'
  | 'REJECTED'
  | 'VOIDED';

export interface ChangeOrderLineDTO {
  id: string;
  costCodeId: string | null;
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
  amount: string;
  currencyCode: string;
}

export interface ChangeOrderDTO {
  id: string;
  organizationId: string;
  projectId: string;
  changeOrderNumber: string;
  title: string;
  description: string | null;
  reason: string | null;
  status: ChangeOrderStatus;
  contractAmount: string | null;
  revisedContractAmount: string | null;
  currencyCode: string;
  version: number;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  clientApprovedBy: string | null;
  clientApprovedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  effectedBy: string | null;
  effectedAt: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  lines: ChangeOrderLineDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateChangeOrderInput {
  title: string;               // min:1 max:160
  description?: string;        // max:5000
  reason?: string;             // max:2000
  currencyCode: string;        // 3-char uppercase
  contractAmount?: string;     // decimal
  lines?: ChangeOrderLineInput[];
  expectedVersion?: number;
}

export interface ChangeOrderLineInput {
  costCodeId?: string;
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
  amount: string;
  currencyCode: string;
}

// ── Schedule of Values ────────────────────────────────────────────────────────

export type SOVStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

export interface SOVLineDTO {
  id: string;
  sovId: string;
  lineNumber: number;
  description: string;
  costCodeId: string | null;
  scheduledValue: string;
  currencyCode: string;
  percentComplete: string;
  workCompletedThisPeriod: string;
  workCompletedPreviousPeriods: string;
  workCompletedToDate: string;
  storedMaterials: string;
  totalEarned: string;
  balanceToFinish: string;
  retainagePercent: string;
  retainageAmount: string;
}

export interface SOVDTO {
  id: string;
  organizationId: string;
  projectId: string;
  sovNumber: string;
  title: string;
  description: string | null;
  status: SOVStatus;
  currencyCode: string;
  totalScheduledValue: string;
  version: number;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  lines: SOVLineDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface SOVProgressDTO {
  sovId: string;
  totalScheduledValue: string;
  totalEarnedToDate: string;
  totalRetainage: string;
  percentComplete: string;
  lines: Array<{
    lineId: string;
    description: string;
    scheduledValue: string;
    percentComplete: string;
    totalEarned: string;
  }>;
}

export interface CreateSOVInput {
  title: string;
  description?: string;
  currencyCode: string;
  lines?: SOVLineInput[];
  expectedVersion?: number;
}

export interface SOVLineInput {
  description: string;
  costCodeId?: string;
  scheduledValue: string;
  currencyCode: string;
  retainagePercent?: string;
}

// ── Payment Application ───────────────────────────────────────────────────────

export type PaymentApplicationStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'VOID';

export interface PaymentApplicationDTO {
  id: string;
  organizationId: string;
  projectId: string;
  applicationNumber: string;
  periodStart: string;
  periodEnd: string;
  status: PaymentApplicationStatus;
  scheduledValue: string;
  workCompletedThisPeriod: string;
  workCompletedPreviousPeriods: string;
  workCompletedToDate: string;
  storedMaterials: string;
  totalEarned: string;
  retainageAmount: string;
  previousRetainage: string;
  totalRetainageHeld: string;
  netAmountDue: string;
  approvedAmount: string | null;
  currencyCode: string;
  version: number;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentApplicationInput {
  periodStart: string;         // YYYY-MM-DD
  periodEnd: string;           // YYYY-MM-DD
  currencyCode: string;
  workCompletedThisPeriod?: string;
  storedMaterials?: string;
  notes?: string;
}

// ── Invoice ───────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'VOID';
export type InvoiceType = 'PROGRESS' | 'FINAL' | 'VARIATION' | 'RETAINAGE_RELEASE' | 'ADVANCE' | 'OTHER';

export interface InvoiceLineDTO {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
  amount: string;
  taxPercent: string;
  taxAmount: string;
  totalAmount: string;
  costCodeId: string | null;
}

export interface InvoiceDTO {
  id: string;
  organizationId: string;
  projectId: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  currencyCode: string;
  paymentApplicationId: string | null;
  description: string | null;
  notes: string | null;
  version: number;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  lines: InvoiceLineDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  invoiceType: InvoiceType;
  issueDate: string;           // YYYY-MM-DD
  dueDate?: string;
  paymentApplicationId?: string;
  description?: string;
  notes?: string;
  currencyCode: string;
  lines: InvoiceLineInput[];
  expectedVersion?: number;
}

export interface InvoiceLineInput {
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
  amount: string;
  taxPercent?: string;
  costCodeId?: string;
}

// ── Payment ───────────────────────────────────────────────────────────────────

export type PaymentStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'VOID';
export type PaymentMethod = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'ONLINE' | 'OTHER';

export interface PaymentDTO {
  id: string;
  organizationId: string;
  projectId: string;
  invoiceId: string;
  paymentNumber: string;
  status: PaymentStatus;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  amount: string;
  currencyCode: string;
  reference: string | null;
  notes: string | null;
  version: number;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  executedBy: string | null;
  executedAt: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  paymentDate: string;         // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  amount: string;              // decimal
  currencyCode: string;
  reference?: string;
  notes?: string;
}

// ── Retainage ─────────────────────────────────────────────────────────────────

export type RetainageStatus = 'HELD' | 'PARTIALLY_RELEASED' | 'FULLY_RELEASED';

export interface RetainageDTO {
  id: string;
  organizationId: string;
  projectId: string;
  paymentApplicationId: string;
  heldAmount: string;
  releasedAmount: string;
  remainingAmount: string;
  currencyCode: string;
  status: RetainageStatus;
  version: number;
  heldBy: string;
  heldAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetainageReleaseDTO {
  id: string;
  retainageId: string;
  amount: string;
  currencyCode: string;
  reason: string;
  releasedBy: string;
  releasedAt: string;
  createdAt: string;
}

// ── Cost Transaction ──────────────────────────────────────────────────────────

export type CostTransactionStatus = 'DRAFT' | 'POSTED' | 'VOIDED';
export type CostTransactionSourceType = 'MANUAL' | 'DOCUMENT' | 'TASK' | 'PHASE';

export interface CostTransactionDTO {
  id: string;
  organizationId: string;
  projectId: string;
  costCodeId: string;
  phaseId: string | null;
  taskId: string | null;
  documentId: string | null;
  sourceType: CostTransactionSourceType;
  sourceId: string | null;
  transactionDate: string;
  postingDate: string | null;
  description: string;
  quantity: string | null;
  unit: string | null;
  unitCost: string | null;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currencyCode: string;
  status: CostTransactionStatus;
  createdBy: string;
  postedBy: string | null;
  postedAt: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  version: number;
  reversalId: string | null;
  createdAt: string;
}

export interface CreateCostTransactionInput {
  costCodeId: string;          // required
  transactionDate: string;     // YYYY-MM-DD required
  description: string;         // min:1 max:1000 required
  currencyCode: string;        // required
  phaseId?: string;
  taskId?: string;
  documentId?: string;
  sourceType?: CostTransactionSourceType; // default MANUAL
  sourceId?: string;
  quantity?: string;           // /^\d{1,12}(?:\.\d{1,3})?$/
  unit?: string;               // max:64
  unitCost?: string;           // /^\d{1,13}(?:\.\d{1,2})?$/
  subtotal?: string;           // /^\d{1,13}(?:\.\d{1,2})?$/
  taxAmount?: string;          // /^\d{1,13}(?:\.\d{1,2})?$/
}

// ── Commercial Summary ────────────────────────────────────────────────────────

export interface CommercialCurrencyBreakdown {
  currencyCode: string;
  originalBudget: string;
  approvedBudgetChanges: string;
  revisedBudget: string;
  committed: string;
  postedActual: string;
  forecast: string | null;
  variance: string | null;
  approvedRevisionNumber: number | null;
}

export interface CommercialSummaryDTO {
  costCode: { id: string; code: string; description: string | null } | null;
  currencyBreakdown: CommercialCurrencyBreakdown[];
  forecastBasis: string | null;
  forecastUnavailableReason: string;
  commitmentCoverage: string;
  subcontractCommitments: string;
  invoiceLifecycleCoverage: string;
}

// ── Financial Summary ─────────────────────────────────────────────────────────

export interface CostSummaryDTO {
  currencyCode: string;
  directCost: string;
  overhead: string;
  contingency: string;
  totalCost: string;
  forecastCost: string | null;
  documentedForecastCoverage: string;
}

export interface CommitmentSummaryDTO {
  currencyCode: string;
  approvedPOTotal: string;
  subcontractTotal: string;
  totalCommitted: string;
}

export interface BillingSummaryDTO {
  currencyCode: string;
  contractAmount: string;
  approvedChanges: string;
  revisedContractAmount: string;
  totalBilled: string;
  totalApproved: string;
  totalOutstanding: string;
  retainageHeld: string;
  retainageReleased: string;
  netRetainage: string;
}

export interface CashSummaryDTO {
  currencyCode: string;
  totalReceived: string;
  totalPaid: string;
  netCash: string;
}

export interface FinancialSummaryDTO {
  cost: CostSummaryDTO[];
  commitments: CommitmentSummaryDTO[];
  billing: BillingSummaryDTO[];
  cash: CashSummaryDTO[];
}

export interface FinancialAuditEventDTO {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface FinancialAuditPageDTO {
  events: FinancialAuditEventDTO[];
  nextCursor: string | null;
}

// ── Transition Inputs (Common) ────────────────────────────────────────────────

export interface TransitionInput {
  expectedVersion: number;
}

export interface RejectInput {
  expectedVersion: number;
  reason: string;
}

export interface UpdateChangeOrderInput {
  title?: string;
  description?: string;
  reason?: string;
}

export interface UpdateSOVInput {
  description?: string;
}

export interface UpdatePaymentApplicationInput {
  notes?: string;
}

export interface UpdateInvoiceInput {
  description?: string;
  notes?: string;
}
