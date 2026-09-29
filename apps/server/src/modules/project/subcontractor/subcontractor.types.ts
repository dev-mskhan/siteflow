// apps/server/src/modules/project/subcontractor/subcontractor.types.ts
export type SubcontractorStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type ProjectSubcontractorStatus = 'ACTIVE' | 'INACTIVE';

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

export interface ProjectSubcontractorDTO {
  id: string;
  organizationId: string;
  projectId: string;
  subcontractorId: string;
  status: ProjectSubcontractorStatus;
  scopeDescription: string | null;
  contractValue: string | null;
  currencyCode: string | null;
  startDate: string | null;
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

export interface CreateSubcontractorInput {
  legalName: string;
  displayName: string;
  trade?: string;
  registrationReference?: string;
  taxReference?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  address?: string;
  notes?: string;
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
  scopeDescription?: string;
  contractValue?: string;
  currencyCode?: string;
  startDate?: string;
  endDate?: string;
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
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
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
  assignmentRole?: string;
}

export interface ListSubcontractorsQuery {
  cursor?: string;
  limit?: number;
  status?: SubcontractorStatus;
}
