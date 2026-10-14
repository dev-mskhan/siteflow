/**
 * project.fixtures.ts — typed mock data for Group 1 project screens.
 *
 * Every field matches the exact server DTO shapes from:
 *   - core/project.mapper.ts → toProjectDTO()
 *   - phases/project-phase.service.ts (DB schema → ProjectPhase)
 *   - cost-codes/project-cost-code.service.ts (DB schema → ProjectCostCode)
 *   - budget/budget.types.ts → ProjectBudgetDTO
 *   - members/project-member.types.ts → ProjectMemberDTO
 *   - settings/project-settings.service.ts → EffectiveProjectSettings
 *
 * CRITICAL notes for future real-API integration:
 *   - ProjectDTO does NOT include `version` (server strips it — see toProjectDTO)
 *     The internal version is tracked in projectSlice as `activeProjectVersion`
 *   - Budget DOES include `version` (used for expectedVersion in PATCH body)
 *   - projectNumber is auto-generated server-side e.g. "PRJ-0001"
 *   - currency on ProjectDTO comes from the projects table row, not settings
 *   - EffectiveProjectSettings.currency also comes from project row (merged)
 */

import type {
  ProjectDTO,
  PhaseDTO,
  CostCodeDTO,
  ProjectBudgetDTO,
  ProjectBudgetSummaryDTO,
  ProjectMemberDTO,
  EffectiveProjectSettings,
} from '../features/project/projectTypes';

// ── Projects ──────────────────────────────────────────────────────────────────

export const MOCK_PROJECTS: ProjectDTO[] = [
  {
    id: 'proj_01',
    organizationId: 'org_01',
    projectNumber: 'PRJ-0001',
    name: 'Gulberg Commercial Plaza',
    description: 'G+6 mixed-use commercial development at Main Boulevard Gulberg.',
    status: 'ACTIVE',
    projectType: 'COMMERCIAL',
    contractValue: '85000000.00',
    currency: 'PKR',
    plannedStartDate: '2025-01-15',
    plannedEndDate: '2026-06-30',
    actualStartDate: '2025-01-20',
    actualEndDate: null,
    createdBy: 'usr_01',
    createdAt: '2024-12-01T08:00:00.000Z',
    updatedAt: '2025-03-10T10:22:00.000Z',
  },
  {
    id: 'proj_02',
    organizationId: 'org_01',
    projectNumber: 'PRJ-0002',
    name: 'DHA Villas Phase 5',
    description: '24-unit residential development in DHA Phase 5.',
    status: 'ACTIVE',
    projectType: 'RESIDENTIAL',
    contractValue: '42000000.00',
    currency: 'PKR',
    plannedStartDate: '2025-03-01',
    plannedEndDate: '2026-02-28',
    actualStartDate: '2025-03-05',
    actualEndDate: null,
    createdBy: 'usr_01',
    createdAt: '2025-01-15T09:00:00.000Z',
    updatedAt: '2025-03-15T11:00:00.000Z',
  },
  {
    id: 'proj_03',
    organizationId: 'org_01',
    projectNumber: 'PRJ-0003',
    name: 'Ring Road Underpass Extension',
    description: 'Civil infrastructure — dual-lane underpass 400m extension.',
    status: 'DRAFT',
    projectType: 'INFRASTRUCTURE',
    contractValue: '120000000.00',
    currency: 'PKR',
    plannedStartDate: '2025-06-01',
    plannedEndDate: '2027-03-31',
    actualStartDate: null,
    actualEndDate: null,
    createdBy: 'usr_02',
    createdAt: '2025-02-20T07:30:00.000Z',
    updatedAt: '2025-02-20T07:30:00.000Z',
  },
  {
    id: 'proj_04',
    organizationId: 'org_01',
    projectNumber: 'PRJ-0004',
    name: 'Textile Factory Expansion',
    description: 'Industrial shed addition — 3 weaving halls, 12,000 sqft.',
    status: 'ON_HOLD',
    projectType: 'INDUSTRIAL',
    contractValue: '18500000.00',
    currency: 'PKR',
    plannedStartDate: '2024-09-01',
    plannedEndDate: '2025-05-31',
    actualStartDate: '2024-09-10',
    actualEndDate: null,
    createdBy: 'usr_01',
    createdAt: '2024-08-01T06:00:00.000Z',
    updatedAt: '2025-01-12T14:00:00.000Z',
  },
];

// Companion version map — NOT part of DTO, tracked in projectSlice
// Maps projectId → current server version for optimistic-lock PATCH calls
export const MOCK_PROJECT_VERSIONS: Record<string, number> = {
  proj_01: 4,
  proj_02: 2,
  proj_03: 1,
  proj_04: 3,
};

// ── Phases ────────────────────────────────────────────────────────────────────

export const MOCK_PHASES: Record<string, PhaseDTO[]> = {
  proj_01: [
    {
      id: 'phase_01_1',
      projectId: 'proj_01',
      organizationId: 'org_01',
      name: 'Sub-Structure',
      description: 'Foundations, pile caps, and basement slab.',
      status: 'ACTIVE',
      sortOrder: 0,
      startsAt: '2025-01-20',
      endsAt: '2025-05-15',
      createdBy: 'usr_01',
      createdAt: '2024-12-01T08:00:00.000Z',
      updatedAt: '2024-12-01T08:00:00.000Z',
    },
    {
      id: 'phase_01_2',
      projectId: 'proj_01',
      organizationId: 'org_01',
      name: 'Super-Structure',
      description: 'Columns, beams, and slab to G+6.',
      status: 'ACTIVE',
      sortOrder: 1,
      startsAt: '2025-05-16',
      endsAt: '2025-11-30',
      createdBy: 'usr_01',
      createdAt: '2024-12-01T08:05:00.000Z',
      updatedAt: '2024-12-01T08:05:00.000Z',
    },
    {
      id: 'phase_01_3',
      projectId: 'proj_01',
      organizationId: 'org_01',
      name: 'Finishes & MEP',
      description: 'Internal finishes, mechanical, electrical, plumbing.',
      status: 'ACTIVE',
      sortOrder: 2,
      startsAt: '2025-12-01',
      endsAt: '2026-05-31',
      createdBy: 'usr_01',
      createdAt: '2024-12-01T08:10:00.000Z',
      updatedAt: '2024-12-01T08:10:00.000Z',
    },
  ],
  proj_02: [
    {
      id: 'phase_02_1',
      projectId: 'proj_02',
      organizationId: 'org_01',
      name: 'Foundation Works',
      description: 'Strip footings for all 24 units.',
      status: 'ACTIVE',
      sortOrder: 0,
      startsAt: '2025-03-05',
      endsAt: '2025-06-30',
      createdBy: 'usr_01',
      createdAt: '2025-01-15T09:00:00.000Z',
      updatedAt: '2025-01-15T09:00:00.000Z',
    },
    {
      id: 'phase_02_2',
      projectId: 'proj_02',
      organizationId: 'org_01',
      name: 'Structure & Roofing',
      description: 'RCC frame and roof slab.',
      status: 'ACTIVE',
      sortOrder: 1,
      startsAt: '2025-07-01',
      endsAt: '2025-12-31',
      createdBy: 'usr_01',
      createdAt: '2025-01-15T09:05:00.000Z',
      updatedAt: '2025-01-15T09:05:00.000Z',
    },
  ],
  proj_03: [],
  proj_04: [
    {
      id: 'phase_04_1',
      projectId: 'proj_04',
      organizationId: 'org_01',
      name: 'Steel Structure',
      description: 'Pre-engineered steel frame erection.',
      status: 'ACTIVE',
      sortOrder: 0,
      startsAt: '2024-09-10',
      endsAt: '2025-01-31',
      createdBy: 'usr_01',
      createdAt: '2024-08-01T06:00:00.000Z',
      updatedAt: '2024-08-01T06:00:00.000Z',
    },
  ],
};

// ── Cost Codes ────────────────────────────────────────────────────────────────

export const MOCK_COST_CODES: Record<string, CostCodeDTO[]> = {
  proj_01: [
    { id: 'cc_01_1', projectId: 'proj_01', organizationId: 'org_01', code: 'EARTH-01', description: 'Earthworks and excavation', isActive: true, createdBy: 'usr_01', createdAt: '2024-12-01T08:00:00.000Z', updatedAt: '2024-12-01T08:00:00.000Z' },
    { id: 'cc_01_2', projectId: 'proj_01', organizationId: 'org_01', code: 'CONC-01', description: 'Concrete — sub-structure', isActive: true, createdBy: 'usr_01', createdAt: '2024-12-01T08:01:00.000Z', updatedAt: '2024-12-01T08:01:00.000Z' },
    { id: 'cc_01_3', projectId: 'proj_01', organizationId: 'org_01', code: 'CONC-02', description: 'Concrete — super-structure', isActive: true, createdBy: 'usr_01', createdAt: '2024-12-01T08:02:00.000Z', updatedAt: '2024-12-01T08:02:00.000Z' },
    { id: 'cc_01_4', projectId: 'proj_01', organizationId: 'org_01', code: 'STEEL-01', description: 'Structural steel and rebar', isActive: true, createdBy: 'usr_01', createdAt: '2024-12-01T08:03:00.000Z', updatedAt: '2024-12-01T08:03:00.000Z' },
    { id: 'cc_01_5', projectId: 'proj_01', organizationId: 'org_01', code: 'MASON-01', description: 'Masonry and blockwork', isActive: true, createdBy: 'usr_01', createdAt: '2024-12-01T08:04:00.000Z', updatedAt: '2024-12-01T08:04:00.000Z' },
    { id: 'cc_01_6', projectId: 'proj_01', organizationId: 'org_01', code: 'MEP-01', description: 'Mechanical, electrical, plumbing', isActive: true, createdBy: 'usr_01', createdAt: '2024-12-01T08:05:00.000Z', updatedAt: '2024-12-01T08:05:00.000Z' },
    { id: 'cc_01_7', projectId: 'proj_01', organizationId: 'org_01', code: 'FINISH-01', description: 'Internal and external finishes', isActive: false, createdBy: 'usr_01', createdAt: '2024-12-01T08:06:00.000Z', updatedAt: '2025-02-01T10:00:00.000Z' },
  ],
  proj_02: [
    { id: 'cc_02_1', projectId: 'proj_02', organizationId: 'org_01', code: 'FOUND-01', description: 'Foundation works', isActive: true, createdBy: 'usr_01', createdAt: '2025-01-15T09:00:00.000Z', updatedAt: '2025-01-15T09:00:00.000Z' },
    { id: 'cc_02_2', projectId: 'proj_02', organizationId: 'org_01', code: 'STRUC-01', description: 'Structural frame', isActive: true, createdBy: 'usr_01', createdAt: '2025-01-15T09:01:00.000Z', updatedAt: '2025-01-15T09:01:00.000Z' },
    { id: 'cc_02_3', projectId: 'proj_02', organizationId: 'org_01', code: 'BRICK-01', description: 'Brickwork and blockwork', isActive: true, createdBy: 'usr_01', createdAt: '2025-01-15T09:02:00.000Z', updatedAt: '2025-01-15T09:02:00.000Z' },
  ],
  proj_03: [],
  proj_04: [
    { id: 'cc_04_1', projectId: 'proj_04', organizationId: 'org_01', code: 'STEEL-01', description: 'Pre-engineered steel structure', isActive: true, createdBy: 'usr_01', createdAt: '2024-08-01T06:00:00.000Z', updatedAt: '2024-08-01T06:00:00.000Z' },
  ],
};

// ── Budgets ───────────────────────────────────────────────────────────────────

export const MOCK_BUDGETS: Record<string, ProjectBudgetDTO | null> = {
  proj_01: {
    id: 'bud_01',
    organizationId: 'org_01',
    projectId: 'proj_01',
    currencyCode: 'PKR',
    status: 'APPROVED',
    version: 3,
    currentRevisionNumber: 2,
    createdBy: 'usr_01',
    submittedBy: 'usr_01',
    submittedAt: '2025-01-10T10:00:00.000Z',
    approvedBy: 'usr_02',
    approvedAt: '2025-01-12T14:00:00.000Z',
    closedAt: null,
    createdAt: '2025-01-08T08:00:00.000Z',
    updatedAt: '2025-01-12T14:00:00.000Z',
    revision: {
      id: 'rev_01_2',
      revisionNumber: 2,
      status: 'APPROVED',
      createdBy: 'usr_01',
      submittedBy: 'usr_01',
      submittedAt: '2025-01-10T10:00:00.000Z',
      approvedBy: 'usr_02',
      approvedAt: '2025-01-12T14:00:00.000Z',
    },
    lines: [
      { id: 'bl_01_1', lineNumber: 1, costCodeId: 'cc_01_1', phaseId: 'phase_01_1', description: 'Excavation and earthworks', amount: '3500000.00' },
      { id: 'bl_01_2', lineNumber: 2, costCodeId: 'cc_01_2', phaseId: 'phase_01_1', description: 'Pile foundation concrete', amount: '12000000.00' },
      { id: 'bl_01_3', lineNumber: 3, costCodeId: 'cc_01_3', phaseId: 'phase_01_2', description: 'Super-structure concrete', amount: '22000000.00' },
      { id: 'bl_01_4', lineNumber: 4, costCodeId: 'cc_01_4', phaseId: 'phase_01_2', description: 'Rebar and structural steel', amount: '18000000.00' },
      { id: 'bl_01_5', lineNumber: 5, costCodeId: 'cc_01_5', phaseId: 'phase_01_3', description: 'Masonry and blockwork', amount: '9500000.00' },
      { id: 'bl_01_6', lineNumber: 6, costCodeId: 'cc_01_6', phaseId: 'phase_01_3', description: 'MEP installations', amount: '20000000.00' },
    ],
    total: '85000000.00',
  },
  proj_02: {
    id: 'bud_02',
    organizationId: 'org_01',
    projectId: 'proj_02',
    currencyCode: 'PKR',
    status: 'DRAFT',
    version: 1,
    currentRevisionNumber: 1,
    createdBy: 'usr_01',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    closedAt: null,
    createdAt: '2025-02-01T10:00:00.000Z',
    updatedAt: '2025-02-01T10:00:00.000Z',
    revision: {
      id: 'rev_02_1',
      revisionNumber: 1,
      status: 'DRAFT',
      createdBy: 'usr_01',
      submittedBy: null,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
    },
    lines: [
      { id: 'bl_02_1', lineNumber: 1, costCodeId: 'cc_02_1', phaseId: 'phase_02_1', description: 'Foundation works', amount: '8000000.00' },
      { id: 'bl_02_2', lineNumber: 2, costCodeId: 'cc_02_2', phaseId: 'phase_02_2', description: 'Structure and roofing', amount: '22000000.00' },
      { id: 'bl_02_3', lineNumber: 3, costCodeId: 'cc_02_3', phaseId: null, description: 'Brickwork', amount: '12000000.00' },
    ],
    total: '42000000.00',
  },
  proj_03: null, // no budget yet
  proj_04: {
    id: 'bud_04',
    organizationId: 'org_01',
    projectId: 'proj_04',
    currencyCode: 'PKR',
    status: 'PENDING_APPROVAL',
    version: 2,
    currentRevisionNumber: 1,
    createdBy: 'usr_01',
    submittedBy: 'usr_01',
    submittedAt: '2024-08-20T09:00:00.000Z',
    approvedBy: null,
    approvedAt: null,
    closedAt: null,
    createdAt: '2024-08-15T07:00:00.000Z',
    updatedAt: '2024-08-20T09:00:00.000Z',
    revision: {
      id: 'rev_04_1',
      revisionNumber: 1,
      status: 'PENDING_APPROVAL',
      createdBy: 'usr_01',
      submittedBy: 'usr_01',
      submittedAt: '2024-08-20T09:00:00.000Z',
      approvedBy: null,
      approvedAt: null,
    },
    lines: [
      { id: 'bl_04_1', lineNumber: 1, costCodeId: 'cc_04_1', phaseId: 'phase_04_1', description: 'Steel structure supply and erection', amount: '18500000.00' },
    ],
    total: '18500000.00',
  },
};

export const MOCK_BUDGET_SUMMARIES: Record<string, ProjectBudgetSummaryDTO> = {
  proj_01: {
    currencyCode: 'PKR',
    original: '82000000.00',
    approvedChanges: '3000000.00',
    revised: '85000000.00',
    approvedRevisionNumber: 2,
  },
  proj_02: {
    currencyCode: 'PKR',
    original: '0.00',
    approvedChanges: '0.00',
    revised: '0.00',
    approvedRevisionNumber: null,
  },
  proj_03: {
    currencyCode: 'PKR',
    original: '0.00',
    approvedChanges: '0.00',
    revised: '0.00',
    approvedRevisionNumber: null,
  },
  proj_04: {
    currencyCode: 'PKR',
    original: '0.00',
    approvedChanges: '0.00',
    revised: '0.00',
    approvedRevisionNumber: null,
  },
};

// ── Members ───────────────────────────────────────────────────────────────────

export const MOCK_PROJECT_MEMBERS: Record<string, ProjectMemberDTO[]> = {
  proj_01: [
    {
      id: 'pm_01_1',
      userId: 'usr_01',
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      addedBy: 'usr_01',
      createdAt: '2024-12-01T08:00:00.000Z',
      user: { id: 'usr_01', firstName: 'Tariq', lastName: 'Mehmood', email: 'tariq@company.com' },
    },
    {
      id: 'pm_01_2',
      userId: 'usr_02',
      role: 'SITE_SUPERVISOR',
      status: 'ACTIVE',
      addedBy: 'usr_01',
      createdAt: '2024-12-05T09:00:00.000Z',
      user: { id: 'usr_02', firstName: 'Imran', lastName: 'Khan', email: 'imran@company.com' },
    },
    {
      id: 'pm_01_3',
      userId: 'usr_03',
      role: 'FINANCE',
      status: 'ACTIVE',
      addedBy: 'usr_01',
      createdAt: '2024-12-06T10:00:00.000Z',
      user: { id: 'usr_03', firstName: 'Sara', lastName: 'Ahmed', email: 'sara@company.com' },
    },
    {
      id: 'pm_01_4',
      userId: 'usr_04',
      role: 'PROCUREMENT',
      status: 'ACTIVE',
      addedBy: 'usr_01',
      createdAt: '2024-12-07T11:00:00.000Z',
      user: { id: 'usr_04', firstName: 'Ali', lastName: 'Hassan', email: 'ali@company.com' },
    },
  ],
  proj_02: [
    {
      id: 'pm_02_1',
      userId: 'usr_01',
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      addedBy: 'usr_01',
      createdAt: '2025-01-15T09:00:00.000Z',
      user: { id: 'usr_01', firstName: 'Tariq', lastName: 'Mehmood', email: 'tariq@company.com' },
    },
    {
      id: 'pm_02_2',
      userId: 'usr_02',
      role: 'SITE_SUPERVISOR',
      status: 'ACTIVE',
      addedBy: 'usr_01',
      createdAt: '2025-01-16T10:00:00.000Z',
      user: { id: 'usr_02', firstName: 'Imran', lastName: 'Khan', email: 'imran@company.com' },
    },
  ],
  proj_03: [
    {
      id: 'pm_03_1',
      userId: 'usr_02',
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      addedBy: 'usr_02',
      createdAt: '2025-02-20T07:30:00.000Z',
      user: { id: 'usr_02', firstName: 'Imran', lastName: 'Khan', email: 'imran@company.com' },
    },
  ],
  proj_04: [
    {
      id: 'pm_04_1',
      userId: 'usr_01',
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      addedBy: 'usr_01',
      createdAt: '2024-08-01T06:00:00.000Z',
      user: { id: 'usr_01', firstName: 'Tariq', lastName: 'Mehmood', email: 'tariq@company.com' },
    },
  ],
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const MOCK_PROJECT_SETTINGS: Record<string, EffectiveProjectSettings> = {
  proj_01: { timezone: 'Asia/Karachi', locale: 'en-PK', dateFormat: 'DD_MM_YYYY', timeFormat: 'H12', unitSystem: 'METRIC', weekStartsOn: 1, currency: 'PKR' },
  proj_02: { timezone: 'Asia/Karachi', locale: 'en-PK', dateFormat: 'DD_MM_YYYY', timeFormat: 'H12', unitSystem: 'METRIC', weekStartsOn: 1, currency: 'PKR' },
  proj_03: { timezone: 'Asia/Karachi', locale: 'en-PK', dateFormat: 'DD_MM_YYYY', timeFormat: 'H12', unitSystem: 'METRIC', weekStartsOn: 1, currency: 'PKR' },
  proj_04: { timezone: 'Asia/Karachi', locale: 'en-PK', dateFormat: 'DD_MM_YYYY', timeFormat: 'H12', unitSystem: 'METRIC', weekStartsOn: 1, currency: 'PKR' },
};
