/**
 * projectTypes.ts — frontend TypeScript interfaces mirroring server DTOs exactly.
 *
 * Sources:
 *   ProjectDTO         → core/project.mapper.ts toProjectDTO() + core/project.types.ts
 *   PhaseDTO           → DB schema projectPhases (project.schema.ts)
 *   CostCodeDTO        → DB schema projectCostCodes (project.schema.ts)
 *   ProjectBudgetDTO   → budget/budget.types.ts
 *   ProjectMemberDTO   → members/project-member.types.ts toProjectMemberDTO()
 *   EffectiveSettings  → settings/project-settings.service.ts
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type ProjectType =
  | 'COMMERCIAL'
  | 'RESIDENTIAL'
  | 'INDUSTRIAL'
  | 'INFRASTRUCTURE'
  | 'OTHER';

export type ProjectRole =
  | 'PROJECT_MANAGER'
  | 'SITE_SUPERVISOR'
  | 'PROJECT_MEMBER'
  | 'FINANCE'
  | 'PROCUREMENT'
  | 'SUBCONTRACTOR'
  | 'CLIENT';

export type ProjectBudgetStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'CLOSED';

export type PhaseStatus = 'ACTIVE' | 'ARCHIVED';
export type ProjectTransition = 'activate' | 'hold' | 'resume' | 'complete' | 'cancel' | 'archive';

// ── Project ───────────────────────────────────────────────────────────────────

/** API surface — version is STRIPPED by server (see toProjectDTO). Track separately. */
export interface ProjectDTO {
  id: string;
  organizationId: string;
  projectNumber: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  projectType: ProjectType | null;
  contractValue: string | null;    // decimal string e.g. "85000000.00"
  currency: string;                // ISO 3-char — from project row, not settings
  plannedStartDate: string | null; // YYYY-MM-DD
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Phase ─────────────────────────────────────────────────────────────────────

export interface PhaseDTO {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: PhaseStatus;
  sortOrder: number;
  startsAt: string | null;  // YYYY-MM-DD
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Cost Code ─────────────────────────────────────────────────────────────────

export interface CostCodeDTO {
  id: string;
  projectId: string;
  organizationId: string;
  code: string;               // uppercase alphanumeric + hyphens, unique per project
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Budget ────────────────────────────────────────────────────────────────────

export interface ProjectBudgetLineDTO {
  id: string;
  lineNumber: number;
  costCodeId: string;
  phaseId: string | null;
  description: string | null;
  amount: string;             // formatted decimal string e.g. "3500000.00"
}

export interface ProjectBudgetDTO {
  id: string;
  organizationId: string;
  projectId: string;
  currencyCode: string;
  status: ProjectBudgetStatus;
  version: number;            // PRESENT here — used as expectedVersion in PATCH body
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

// ── Project Member ────────────────────────────────────────────────────────────

export interface ProjectMemberDTO {
  id: string;
  userId: string;
  role: ProjectRole;
  status: 'ACTIVE' | 'REMOVED';
  addedBy: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  };
}

// ── Project Settings ──────────────────────────────────────────────────────────

/** Merged from project row + project_settings override + org_settings fallback */
export interface EffectiveProjectSettings {
  timezone: string;
  locale: string;
  dateFormat: 'DD_MM_YYYY' | 'MM_DD_YYYY' | 'YYYY_MM_DD';
  timeFormat: 'H12' | 'H24';
  unitSystem: 'METRIC' | 'IMPERIAL';
  weekStartsOn: number;  // 0–6
  currency: string;      // from project row (not settings)
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  description?: string;
  projectType?: ProjectType;
  contractValue?: string;
  currency?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

/** PATCH body — expectedVersion is REQUIRED (optimistic concurrency lock) */
export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  projectType?: ProjectType | null;
  contractValue?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  expectedVersion: number;
}
