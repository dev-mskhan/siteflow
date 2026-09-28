// apps/server/src/modules/project/field-log/field-log-amendment.types.ts

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

export interface CreateAmendmentInput {
  reason: string;
  correction: Record<string, unknown>;
}
