export type CommittedCostStatus = 'ACTIVE' | 'RELEASED' | 'CANCELLED';
export type CommitmentLifecycleStatus =
  | 'APPROVED'
  | 'PARTIALLY_INVOICED'
  | 'FULLY_INVOICED'
  | 'CLOSED'
  | 'CANCELLED';

export interface CommittedCostDTO {
  id: string;
  organizationId: string;
  projectId: string;
  sourceType: 'PURCHASE_ORDER';
  sourceId: string;
  supplierId: string | null;
  purchaseOrderId: string | null;
  costCodeId: string | null;
  taskId: string | null;
  boqLineId: string | null;
  currencyCode: string;
  committedAmount: string;
  status: CommittedCostStatus;
  lifecycleStatus: CommitmentLifecycleStatus;
  purchaseOrderStatus: string | null;
  committedAt: string;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListCommittedCostsQuery {
  cursor?: string;
  limit?: number;
  status?: CommittedCostStatus;
}
