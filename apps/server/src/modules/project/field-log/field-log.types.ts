// apps/server/src/modules/project/field-log/field-log.types.ts

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

export interface CreateFieldLogInput {
  logDate: string; // ISO date string YYYY-MM-DD
  notes?: string;
  entries?: Array<{
    taskId: string;
    completionPctRecorded: number;
    quantityCompleted?: number;
    unit?: string;
    notes?: string;
  }>;
}

export interface UpdateFieldLogInput {
  notes?: string;
  entries?: Array<{
    taskId: string;
    completionPctRecorded: number;
    quantityCompleted?: number;
    unit?: string;
    notes?: string;
  }>;
}
