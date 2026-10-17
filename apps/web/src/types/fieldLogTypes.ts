export type FieldLogStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

export interface FieldLogTaskEntryDTO {
  id: string;
  logId: string;
  taskId: string;
  completionPctRecorded: number;
  quantityCompleted: string | null;
  unit: string | null;
  notes: string | null;
}

export interface FieldLogDTO {
  id: string;
  organizationId: string;
  projectId: string;
  logDate: string;
  supervisorId: string;
  status: FieldLogStatus;
  notes: string | null;
  lockedAt: string | null;
  createdAt: string;
  entries?: FieldLogTaskEntryDTO[];
}

export interface FieldLogAmendmentDTO {
  id: string;
  logId: string;
  organizationId: string;
  projectId: string;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string;
  correction: Record<string, unknown>;
  createdAt: string;
}

export interface CreateFieldLogInput {
  logDate: string;
  notes?: string;
  entries?: FieldLogEntryInput[];
}

export interface UpdateFieldLogInput {
  notes?: string;
  entries?: FieldLogEntryInput[];
}

export interface FieldLogEntryInput {
  taskId: string;
  completionPctRecorded: number;
  quantityCompleted?: string;
  unit?: string;
  notes?: string;
}

export interface CreateAmendmentInput {
  reason: string;
  correction: Record<string, unknown>;
}
