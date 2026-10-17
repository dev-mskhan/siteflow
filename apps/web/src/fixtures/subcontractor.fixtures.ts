import type {
  SubcontractorDTO,
  SubcontractorContactDTO,
  ProjectSubcontractorDTO,
  SubcontractorTaskAssignmentDTO,
  PartnerPerformanceEventDTO,
} from '../types/subcontractorTypes';

// ── Org-level subcontractors ──────────────────────────────────────────────────

export const MOCK_SUBCONTRACTORS: Record<string, SubcontractorDTO[]> = {
  org_01: [
    {
      id: 'sub_01',
      organizationId: 'org_01',
      legalName: 'Al-Barkat Construction (Pvt) Ltd',
      displayName: 'Al-Barkat Construction',
      trade: 'Civil & Structural',
      registrationReference: 'SECP-2018-04821',
      taxReference: 'NTN-3781924',
      status: 'ACTIVE',
      primaryEmail: 'contracts@albarkat.com.pk',
      primaryPhone: '+92-51-234-5678',
      address: 'Plot 12, Sector I-9/2, Islamabad',
      notes: 'Preferred contractor for RC frame work',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'sub_02',
      organizationId: 'org_01',
      legalName: 'Khalid Electrical Services',
      displayName: 'Khalid Electrical',
      trade: 'Electrical & ELV',
      registrationReference: null,
      taxReference: 'NTN-4109872',
      status: 'ACTIVE',
      primaryEmail: 'info@khalidelectrical.pk',
      primaryPhone: '+92-300-444-5566',
      address: 'Gulberg III, Lahore',
      notes: null,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
    },
    {
      id: 'sub_03',
      organizationId: 'org_01',
      legalName: 'Premier Finishes Ltd',
      displayName: 'Premier Finishes',
      trade: 'Interior Finishes',
      registrationReference: null,
      taxReference: null,
      status: 'INACTIVE',
      primaryEmail: null,
      primaryPhone: null,
      address: null,
      notes: 'Currently not taking new work',
      createdAt: '2025-11-01T00:00:00.000Z',
      updatedAt: '2026-03-10T00:00:00.000Z',
    },
  ],
};

// ── Org-level contacts ────────────────────────────────────────────────────────

export const MOCK_SUBCONTRACTOR_CONTACTS: Record<string, SubcontractorContactDTO[]> = {
  sub_01: [
    {
      id: 'con_01_1',
      subcontractorId: 'sub_01',
      organizationId: 'org_01',
      name: 'Ahmed Khan',
      role: 'Project Director',
      email: 'ahmed.khan@albarkat.com.pk',
      phone: '+92-321-111-2233',
      isPrimary: true,
      isActive: true,
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'con_01_2',
      subcontractorId: 'sub_01',
      organizationId: 'org_01',
      name: 'Sana Mirza',
      role: 'Contracts Manager',
      email: 'sana.mirza@albarkat.com.pk',
      phone: '+92-333-445-5678',
      isPrimary: false,
      isActive: true,
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
    },
  ],
  sub_02: [
    {
      id: 'con_02_1',
      subcontractorId: 'sub_02',
      organizationId: 'org_01',
      name: 'Khalid Mehmood',
      role: 'Owner',
      email: 'info@khalidelectrical.pk',
      phone: '+92-300-444-5566',
      isPrimary: true,
      isActive: true,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
    },
  ],
  sub_03: [],
};

// ── Project subcontractors ────────────────────────────────────────────────────

export const MOCK_PROJECT_SUBCONTRACTORS: Record<string, ProjectSubcontractorDTO[]> = {
  proj_01: [
    {
      id: 'ps_01',
      organizationId: 'org_01',
      projectId: 'proj_01',
      subcontractorId: 'sub_01',
      status: 'ACTIVE',
      scopeDescription: 'All RC frame works from foundation to roof slab including columns, beams, and slabs. Excludes finishes.',
      contractValue: '8500000.00',
      currencyCode: 'PKR',
      startDate: '2026-10-01',
      endDate: '2027-04-30',
      subcontractor: MOCK_SUBCONTRACTORS.org_01[0]!,
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
    {
      id: 'ps_02',
      organizationId: 'org_01',
      projectId: 'proj_01',
      subcontractorId: 'sub_02',
      status: 'ACTIVE',
      scopeDescription: 'Complete electrical works — main LV panel, distribution boards, wiring, fixtures',
      contractValue: '1200000.00',
      currencyCode: 'PKR',
      startDate: '2027-01-01',
      endDate: '2027-05-31',
      subcontractor: MOCK_SUBCONTRACTORS.org_01[1]!,
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
  ],
};

// ── Task assignments ──────────────────────────────────────────────────────────

export const MOCK_TASK_ASSIGNMENTS: Record<string, SubcontractorTaskAssignmentDTO[]> = {
  sub_01: [
    {
      id: 'ta_01_1',
      organizationId: 'org_01',
      projectId: 'proj_01',
      subcontractorId: 'sub_01',
      taskId: 'task_01_3',
      assignmentRole: 'Main contractor',
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
    {
      id: 'ta_01_2',
      organizationId: 'org_01',
      projectId: 'proj_01',
      subcontractorId: 'sub_01',
      taskId: 'task_01_4',
      assignmentRole: 'Main contractor',
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
  ],
  sub_02: [],
};

// ── Performance events ────────────────────────────────────────────────────────

export const MOCK_PERFORMANCE_EVENTS: Record<string, PartnerPerformanceEventDTO[]> = {
  sub_01: [
    {
      id: 'perf_01_1',
      organizationId: 'org_01',
      projectId: 'proj_01',
      partnerType: 'SUBCONTRACTOR',
      supplierId: null,
      subcontractorId: 'sub_01',
      eventType: 'TASK_COMPLETE_ON_TIME',
      sourceType: 'TASK',
      sourceId: 'task_01_2',
      occurredAt: '2026-10-14T00:00:00.000Z',
      metricValue: null,
      unit: null,
      notes: 'Excavation completed 1 day ahead of schedule',
      createdAt: '2026-10-14T00:00:00.000Z',
    },
    {
      id: 'perf_01_2',
      organizationId: 'org_01',
      projectId: 'proj_01',
      partnerType: 'SUBCONTRACTOR',
      supplierId: null,
      subcontractorId: 'sub_01',
      eventType: 'DELIVERY_LATE',
      sourceType: 'DELIVERY',
      sourceId: 'dl_01',
      occurredAt: '2026-10-20T00:00:00.000Z',
      metricValue: 2,
      unit: 'days',
      notes: 'Equipment mobilisation 2 days late',
      createdAt: '2026-10-20T00:00:00.000Z',
    },
  ],
  sub_02: [],
  // supplier performance keyed by supplierId
  sup_01: [
    {
      id: 'perf_sup_01_1',
      organizationId: 'org_01',
      projectId: 'proj_01',
      partnerType: 'SUPPLIER',
      supplierId: 'sup_01',
      subcontractorId: null,
      eventType: 'DELIVERY_ON_TIME',
      sourceType: 'DELIVERY',
      sourceId: 'dl_01',
      occurredAt: '2026-11-14T00:00:00.000Z',
      metricValue: null,
      unit: null,
      notes: null,
      createdAt: '2026-11-14T00:00:00.000Z',
    },
  ],
};
