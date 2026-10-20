import type { SafetyEventDTO, QualityInspectionDTO, QualityDeficiencyDTO, CorrectiveActionDTO, PermitDTO, ComplianceRecordDTO } from '../types/hseTypes';
import type { RFIDTO, SubmittalDTO, SubmittalRevisionDTO } from '../types/rfiTypes';

export const MOCK_SAFETY_EVENTS: Record<string, SafetyEventDTO[]> = {
  proj_01: [
    { id: 'sev_01', organizationId: 'org_01', projectId: 'proj_01', eventType: 'NEAR_MISS', title: 'Unsecured scaffolding plank — Level 3', description: 'A scaffolding plank on level 3 was found unsecured. Worker noticed before anyone walked on it.', occurredAt: '2024-03-15T09:30:00.000Z', status: 'CLOSED', severity: 'HIGH', location: 'Grid B3, Level 3 scaffolding', involvedParties: 'Scaffold crew team B', assignedTo: 'usr_01', immediateAction: 'Area immediately cordoned off and plank secured.', notes: 'Toolbox talk conducted with scaffold crew.', createdBy: 'usr_01', investigatedBy: 'usr_01', investigatedAt: '2024-03-15T14:00:00.000Z', closedBy: 'usr_01', closedAt: '2024-03-20T10:00:00.000Z', version: 4, createdAt: '2024-03-15T09:30:00.000Z', updatedAt: '2024-03-20T10:00:00.000Z' },
    { id: 'sev_02', organizationId: 'org_01', projectId: 'proj_01', eventType: 'UNSAFE_CONDITION', title: 'Standing water in excavation — Grid D5', description: 'Water accumulation in open excavation at grid D5 creating slip hazard.', occurredAt: '2024-04-10T08:00:00.000Z', status: 'REPORTED', severity: 'MEDIUM', location: 'Grid D5 excavation', involvedParties: null, assignedTo: null, immediateAction: 'Warning signs erected around excavation.', notes: null, createdBy: 'usr_01', investigatedBy: null, investigatedAt: null, closedBy: null, closedAt: null, version: 1, createdAt: '2024-04-10T08:00:00.000Z', updatedAt: '2024-04-10T08:00:00.000Z' },
  ],
};

export const MOCK_QUALITY_INSPECTIONS: Record<string, QualityInspectionDTO[]> = {
  proj_01: [
    { id: 'qi_01', organizationId: 'org_01', projectId: 'proj_01', inspectionType: 'Concrete pour inspection', status: 'COMPLETED', result: 'PASS', scheduledDate: '2024-03-20', performedDate: '2024-03-20', inspectorMemberId: 'usr_01', location: 'Slab — Grid A1-B4', findings: 'All pour requirements met. Mix ratios correct. Vibration adequate.', notes: null, createdBy: 'usr_01', createdAt: '2024-03-18T09:00:00.000Z', updatedAt: '2024-03-20T16:00:00.000Z' },
    { id: 'qi_02', organizationId: 'org_01', projectId: 'proj_01', inspectionType: 'Steel reinforcement inspection', status: 'SCHEDULED', result: null, scheduledDate: '2024-05-15', performedDate: null, inspectorMemberId: 'usr_01', location: 'Level 2 columns', findings: null, notes: 'Pre-pour inspection for level 2 columns.', createdBy: 'usr_01', createdAt: '2024-05-01T08:00:00.000Z', updatedAt: '2024-05-01T08:00:00.000Z' },
  ],
};

export const MOCK_QUALITY_DEFICIENCIES: Record<string, QualityDeficiencyDTO[]> = {
  proj_01: [
    { id: 'qd_01', organizationId: 'org_01', projectId: 'proj_01', title: 'Crack in ground floor slab — Grid C2', status: 'IN_PROGRESS', severity: 'HIGH', inspectionId: 'qi_01', description: 'Visible crack 3mm wide running NE–SW across slab at grid C2. Likely due to inadequate curing.', responsibleMemberId: 'usr_01', dueDate: '2024-04-30', location: 'Grid C2, Ground Floor', notes: 'Structural engineer review requested.', resolvedAt: null, closedAt: null, createdBy: 'usr_01', createdAt: '2024-03-22T10:00:00.000Z', updatedAt: '2024-03-22T10:00:00.000Z' },
  ],
};

export const MOCK_CORRECTIVE_ACTIONS: Record<string, CorrectiveActionDTO[]> = {
  proj_01: [
    { id: 'ca_01', organizationId: 'org_01', projectId: 'proj_01', sourceType: 'QUALITY_DEFICIENCY', sourceId: 'qd_01', title: 'Structural assessment + crack repair', status: 'IN_PROGRESS', description: 'Engage structural engineer to assess slab crack. Epoxy injection repair after assessment.', assignedTo: 'usr_01', dueDate: '2024-04-30', notes: null, completedAt: null, verifiedAt: null, createdBy: 'usr_01', createdAt: '2024-03-23T09:00:00.000Z', updatedAt: '2024-03-23T09:00:00.000Z' },
  ],
};

export const MOCK_PERMITS: Record<string, PermitDTO[]> = {
  proj_01: [
    { id: 'perm_01', organizationId: 'org_01', projectId: 'proj_01', permitType: 'Building Construction Permit', status: 'ACTIVE', referenceNumber: 'BCP-2024-041', issuingAuthority: 'Karachi Development Authority', responsibleMemberId: 'usr_01', issueDate: '2024-01-15', effectiveDate: '2024-01-20', expiryDate: '2025-01-19', notes: 'Permit covers all above-ground works up to 8 floors.', createdBy: 'usr_01', createdAt: '2024-01-10T09:00:00.000Z', updatedAt: '2024-01-20T10:00:00.000Z' },
    { id: 'perm_02', organizationId: 'org_01', projectId: 'proj_01', permitType: 'Environmental NOC', status: 'ISSUED', referenceNumber: 'ENV-2024-017', issuingAuthority: 'Sindh EPA', responsibleMemberId: 'usr_01', issueDate: '2024-02-01', effectiveDate: null, expiryDate: '2025-01-31', notes: null, createdBy: 'usr_01', createdAt: '2024-01-25T09:00:00.000Z', updatedAt: '2024-02-01T10:00:00.000Z' },
  ],
};

export const MOCK_COMPLIANCE_RECORDS: Record<string, ComplianceRecordDTO[]> = {
  proj_01: [
    { id: 'cr_01', organizationId: 'org_01', projectId: 'proj_01', requirementType: 'Insurance Coverage', status: 'ACTIVE', subjectType: 'PROJECT', subjectId: 'proj_01', responsibleMemberId: 'usr_01', effectiveDate: '2024-01-01', expiryDate: '2025-01-01', verificationRef: 'INS-POL-20240101', notes: 'Contractor All-Risk insurance active.', verifiedAt: '2024-01-05T10:00:00.000Z', createdBy: 'usr_01', createdAt: '2024-01-05T09:00:00.000Z', updatedAt: '2024-01-05T10:00:00.000Z' },
  ],
};

// ── RFI & Submittal Fixtures ─────────────────────────────────────────────────

export const MOCK_RFIS: Record<string, RFIDTO[]> = {
  proj_01: [
    { id: 'rfi_01', organizationId: 'org_01', projectId: 'proj_01', rfiNumber: 'RFI-2024-001', title: 'Column grid spacing clarification — Grid A', question: 'Drawing A-101 shows column spacing at 6000mm but structural calc sheet SC-03 shows 5800mm. Which dimension takes precedence for the foundation layout?', response: 'Structural calculations SC-03 take precedence. Grid A column spacing is 5800mm. Drawing A-101 will be revised.', status: 'ANSWERED', priority: 'HIGH', discipline: 'Structural', recipientName: 'ABC Consulting Engineers', dueDate: '2024-03-20', scheduleImpactDays: 0, costImpact: null, linkedTaskId: null, notes: null, createdBy: 'usr_01', submittedAt: '2024-03-12T08:00:00.000Z', respondedAt: '2024-03-18T14:00:00.000Z', closedAt: null, cancelledAt: null, version: 3, createdAt: '2024-03-10T09:00:00.000Z', updatedAt: '2024-03-18T14:00:00.000Z' },
    { id: 'rfi_02', organizationId: 'org_01', projectId: 'proj_01', rfiNumber: 'RFI-2024-002', title: 'Slab reinforcement at stairwell opening', question: 'Drawing S-205 does not show any additional trimmer bars at the stairwell opening on Level 2. Are additional bars required per ACI 318?', response: null, status: 'OPEN', priority: 'NORMAL', discipline: 'Structural', recipientName: 'ABC Consulting Engineers', dueDate: '2024-05-15', scheduleImpactDays: null, costImpact: null, linkedTaskId: null, notes: null, createdBy: 'usr_01', submittedAt: '2024-05-01T08:00:00.000Z', respondedAt: null, closedAt: null, cancelledAt: null, version: 1, createdAt: '2024-04-28T09:00:00.000Z', updatedAt: '2024-05-01T08:00:00.000Z' },
  ],
};

export const MOCK_SUBMITTALS: Record<string, SubmittalDTO[]> = {
  proj_01: [
    { id: 'sub_01', organizationId: 'org_01', projectId: 'proj_01', submittalNumber: 'SUB-2024-001', title: 'Structural Steel Shop Drawings', status: 'APPROVED', revisionNumber: 2, specReference: '05 12 00', discipline: 'Structural', responsibleMemberId: 'usr_01', reviewerMemberId: 'usr_02', dueDate: '2024-02-28', notes: null, reviewResponse: 'APPROVED', reviewNotes: 'Approved as noted. Minor dimensional corrections reflected in Rev 2.', submittedAt: '2024-02-15T09:00:00.000Z', reviewedAt: '2024-02-25T14:00:00.000Z', closedAt: null, version: 4, createdBy: 'usr_01', createdAt: '2024-02-10T08:00:00.000Z', updatedAt: '2024-02-25T14:00:00.000Z' },
    { id: 'sub_02', organizationId: 'org_01', projectId: 'proj_01', submittalNumber: 'SUB-2024-002', title: 'Concrete Mix Design', status: 'SUBMITTED', revisionNumber: 1, specReference: '03 30 00', discipline: 'Concrete', responsibleMemberId: 'usr_01', reviewerMemberId: null, dueDate: '2024-05-20', notes: 'Include 28-day strength test certificates.', reviewResponse: null, reviewNotes: null, submittedAt: '2024-05-05T09:00:00.000Z', reviewedAt: null, closedAt: null, version: 2, createdBy: 'usr_01', createdAt: '2024-05-01T08:00:00.000Z', updatedAt: '2024-05-05T09:00:00.000Z' },
  ],
};

export const MOCK_SUBMITTAL_REVISIONS: Record<string, SubmittalRevisionDTO[]> = {
  sub_01: [
    { id: 'subrev_01', submittalId: 'sub_01', revisionNumber: 1, submittedAt: '2024-02-10T09:00:00.000Z', reviewResponse: 'REVISE_AND_RESUBMIT', reviewNotes: 'Missing weld schedule on page 12. Resubmit with complete weld details.', reviewedAt: '2024-02-20T14:00:00.000Z', createdAt: '2024-02-10T09:00:00.000Z' },
    { id: 'subrev_02', submittalId: 'sub_01', revisionNumber: 2, submittedAt: '2024-02-15T09:00:00.000Z', reviewResponse: 'APPROVED', reviewNotes: 'Approved as noted. Minor dimensional corrections reflected in Rev 2.', reviewedAt: '2024-02-25T14:00:00.000Z', createdAt: '2024-02-15T09:00:00.000Z' },
  ],
  sub_02: [],
};
