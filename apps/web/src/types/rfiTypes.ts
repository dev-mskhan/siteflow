/**
 * rfiTypes — Group 11 RFI & Submittal DTOs mirroring server schemas exactly.
 */

// ── RFI ───────────────────────────────────────────────────────────────────────
export type RFIStatus = 'DRAFT' | 'OPEN' | 'UNDER_REVIEW' | 'ANSWERED' | 'CLOSED' | 'CANCELLED';
export type RFIPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface RFIDTO {
  id: string;
  organizationId: string;
  projectId: string;
  rfiNumber: string;
  title: string;
  question: string;
  response: string | null;
  status: RFIStatus;
  priority: RFIPriority;
  discipline: string | null;
  recipientName: string | null;
  dueDate: string | null;
  scheduleImpactDays: number | null;
  costImpact: number | null;
  linkedTaskId: string | null;
  notes: string | null;
  createdBy: string;
  submittedAt: string | null;
  respondedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRFIInput {
  title: string;              // min:1 max:500
  question: string;           // min:1 max:20000
  discipline?: string | null;
  priority?: RFIPriority;
  recipientName?: string | null;
  dueDate?: string | null;
  scheduleImpactDays?: number;
  costImpact?: number | null;
  linkedTaskId?: string | null;
  notes?: string | null;
}

export interface RespondRFIInput {
  response: string;           // min:1 max:20000
  scheduleImpactDays?: number;
  costImpact?: number | null;
}

// ── Submittal ─────────────────────────────────────────────────────────────────
export type SubmittalStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW'
  | 'APPROVED' | 'REJECTED' | 'REVISE_AND_RESUBMIT' | 'CLOSED';

export type SubmittalReviewResponse =
  | 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REVISE_AND_RESUBMIT' | 'REJECTED';

export interface SubmittalDTO {
  id: string;
  organizationId: string;
  projectId: string;
  submittalNumber: string;
  title: string;
  status: SubmittalStatus;
  revisionNumber: number;
  specReference: string | null;
  discipline: string | null;
  responsibleMemberId: string | null;
  reviewerMemberId: string | null;
  dueDate: string | null;
  notes: string | null;
  reviewResponse: SubmittalReviewResponse | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  closedAt: string | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmittalRevisionDTO {
  id: string;
  submittalId: string;
  revisionNumber: number;
  submittedAt: string;
  reviewResponse: SubmittalReviewResponse | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface CreateSubmittalInput {
  title: string;
  specReference?: string | null;
  discipline?: string | null;
  responsibleMemberId?: string | null;
  reviewerMemberId?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export interface ReviewSubmittalInput {
  response: SubmittalReviewResponse;
  responseNotes?: string | null;
}
