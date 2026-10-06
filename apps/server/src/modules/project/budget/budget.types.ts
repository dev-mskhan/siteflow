import type {
  CreateProjectBudgetInput,
  UpdateProjectBudgetInput,
} from '@siteflow/shared';

export type { CreateProjectBudgetInput, UpdateProjectBudgetInput };

export type ProjectBudgetStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'CLOSED';

export interface ProjectBudgetLineDTO {
  id: string;
  lineNumber: number;
  costCodeId: string;
  phaseId: string | null;
  description: string | null;
  amount: string;
}

export interface ProjectBudgetDTO {
  id: string;
  organizationId: string;
  projectId: string;
  currencyCode: string;
  status: ProjectBudgetStatus;
  version: number;
  currentRevisionNumber: number;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  revision: {
    id: string;
    revisionNumber: number;
    status: ProjectBudgetStatus;
    createdBy: string;
    submittedBy: string | null;
    submittedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
  };
  lines: ProjectBudgetLineDTO[];
  total: string;
}

export interface ProjectBudgetSummaryDTO {
  currencyCode: string;
  original: string;
  approvedChanges: string;
  revised: string;
  approvedRevisionNumber: number | null;
}
