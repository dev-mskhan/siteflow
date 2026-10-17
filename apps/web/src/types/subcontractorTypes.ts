/**
 * Subcontractor types — mirrors:
 *   apps/server/src/modules/project/subcontractor/subcontractor.types.ts
 *   packages/shared/src/modules/project/subcontractor.schema.ts
 */

// ── Enums ──────────────────────────────────────────────────────────────────────

export type SubcontractorStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type ProjectSubcontractorStatus = 'ACTIVE' | 'INACTIVE';
export type PerformanceEventType =
  | 'DELIVERY_ON_TIME'
  | 'DELIVERY_LATE'
  | 'RECEIPT_REJECTION'
  | 'TASK_COMPLETE_ON_TIME'
  | 'TASK_COMPLETE_LATE';

// ── Org-level DTOs ────────────────────────────────────────────────────────────

export interface SubcontractorDTO {
  id: string;
  organizationId: string;
  legalName: string;
  displayName: string;
  trade: string | null;
  registrationReference: string | null;
  taxReference: string | null;
  status: SubcontractorStatus;
  primaryEmail: string | null;
  primaryPhone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubcontractorContactDTO {
  id: string;
  subcontractorId: string;
  organizationId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Project-level DTOs ────────────────────────────────────────────────────────

export interface ProjectSubcontractorDTO {
  id: string;
  organizationId: string;
  projectId: string;
  subcontractorId: string;
  status: ProjectSubcontractorStatus;
  scopeDescription: string | null;
  contractValue: string | null;         // decimal string e.g. "150000.00"
  currencyCode: string | null;          // 3-char ISO e.g. "PKR"
  startDate: string | null;             // YYYY-MM-DD
  endDate: string | null;
  subcontractor: SubcontractorDTO;
  createdAt: string;
  updatedAt: string;
}

export interface SubcontractorTaskAssignmentDTO {
  id: string;
  organizationId: string;
  projectId: string;
  subcontractorId: string;
  taskId: string;
  assignmentRole: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Performance ───────────────────────────────────────────────────────────────

export interface PartnerPerformanceEventDTO {
  id: string;
  organizationId: string;
  projectId: string | null;
  partnerType: 'SUPPLIER' | 'SUBCONTRACTOR';
  supplierId: string | null;
  subcontractorId: string | null;
  eventType: PerformanceEventType | string;
  sourceType: string;                   // 'DELIVERY' | 'RECEIPT' | 'TASK'
  sourceId: string;
  occurredAt: string;
  metricValue: number | null;
  unit: string | null;
  notes: string | null;
  createdAt: string;
}

// ── Input types (from subcontractor.schema.ts) ────────────────────────────────

export interface CreateSubcontractorInput {
  legalName: string;                    // min:1 max:500
  displayName: string;                  // min:1 max:500
  trade?: string;                       // max:200
  registrationReference?: string;       // max:200
  taxReference?: string;                // max:200
  primaryEmail?: string;                // email max:254
  primaryPhone?: string;                // max:50
  address?: string;                     // max:1000
  notes?: string;                       // max:4000
}

export interface UpdateSubcontractorInput {
  legalName?: string;
  displayName?: string;
  trade?: string;
  registrationReference?: string;
  taxReference?: string;
  status?: SubcontractorStatus;
  primaryEmail?: string | null;
  primaryPhone?: string;
  address?: string;
  notes?: string;
}

export interface AssignSubcontractorToProjectInput {
  subcontractorId: string;
  scopeDescription?: string;            // max:2000
  contractValue?: string;               // regex /^\d+(\.\d{1,2})?$/
  currencyCode?: string;                // len:3
  startDate?: string;                   // YYYY-MM-DD
  endDate?: string;                     // YYYY-MM-DD
}

export interface UpdateProjectSubcontractorInput {
  status?: ProjectSubcontractorStatus;
  scopeDescription?: string;
  contractValue?: string | null;
  currencyCode?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CreateContactInput {
  name: string;                         // min:1 max:300
  role?: string;                        // max:200
  email?: string;                       // email max:254
  phone?: string;                       // max:50
  isPrimary?: boolean;                  // default false; partial unique index (only 1 primary per sub)
}

export interface UpdateContactInput {
  name?: string;
  role?: string;
  email?: string | null;
  phone?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface AssignTaskInput {
  taskId: string;
  assignmentRole?: string;              // max:200
}
