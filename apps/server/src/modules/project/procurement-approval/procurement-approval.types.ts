export type ProcurementApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ProcurementApprovalResourceType = 'MATERIAL_REQUEST' | 'QUOTE' | 'PURCHASE_ORDER';

export interface ProcurementApprovalDTO {
  id: string;
  organizationId: string;
  projectId: string;
  resourceType: ProcurementApprovalResourceType;
  resourceId: string;
  status: ProcurementApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApprovalInput {
  resourceType: ProcurementApprovalResourceType;
  resourceId: string;
}

export interface ReviewApprovalInput {
  decisionReason?: string;
}

export interface ListApprovalsQuery {
  cursor?: string;
  limit?: number;
  status?: ProcurementApprovalStatus;
}
