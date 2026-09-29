export type MaterialRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PARTIALLY_ORDERED'
  | 'ORDERED'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'REJECTED';

export type MaterialRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface MaterialRequestItemDTO {
  id: string;
  organizationId: string;
  materialRequestId: string;
  materialId: string;
  description: string | null;
  quantity: string;
  unitCode: string;
  requiredByDate: string | null;
  taskId: string | null;
  phaseId: string | null;
  costCodeId: string | null;
  boqLineId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialRequestDTO {
  id: string;
  organizationId: string;
  projectId: string;
  requestNumber: string;
  requestedByMemberId: string | null;
  status: MaterialRequestStatus;
  requiredByDate: string | null;
  deliveryLocation: string | null;
  priority: MaterialRequestPriority;
  notes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  items: MaterialRequestItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialRequestInput {
  requiredByDate?: string;
  deliveryLocation?: string;
  priority?: MaterialRequestPriority;
  notes?: string;
  items: Array<{
    materialId: string;
    description?: string;
    quantity: string;
    unitCode: string;
    requiredByDate?: string;
    taskId?: string;
    phaseId?: string;
    costCodeId?: string;
    boqLineId?: string;
    notes?: string;
  }>;
}

export interface UpdateMaterialRequestInput {
  requiredByDate?: string;
  deliveryLocation?: string;
  priority?: MaterialRequestPriority;
  notes?: string;
}

export interface ListMaterialRequestsQuery {
  cursor?: string;
  limit?: number;
  status?: MaterialRequestStatus;
}
