/**
 * hseTypes — Group 10 DTOs for Safety, Quality, Compliance.
 */

// ── Safety ────────────────────────────────────────────────────────────────────
export type SafetyEventType = 'INCIDENT' | 'NEAR_MISS' | 'UNSAFE_CONDITION' | 'UNSAFE_ACT' | 'FIRST_AID';
export type SafetyEventStatus = 'REPORTED' | 'UNDER_INVESTIGATION' | 'CORRECTIVE_ACTION_REQUIRED' | 'CORRECTIVE_ACTION_IN_PROGRESS' | 'CLOSED';
export type SafetySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'FATALITY';

export interface SafetyEventDTO {
  id: string;
  organizationId: string;
  projectId: string;
  eventType: SafetyEventType;
  title: string;
  description: string;
  occurredAt: string;
  status: SafetyEventStatus;
  severity: SafetySeverity | null;
  location: string | null;
  involvedParties: string | null;
  assignedTo: string | null;
  immediateAction: string | null;
  notes: string | null;
  createdBy: string;
  investigatedBy: string | null;
  investigatedAt: string | null;
  closedBy: string | null;
  closedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyMeetingDTO {
  id: string;
  organizationId: string;
  projectId: string;
  meetingType: string;
  title: string;
  scheduledAt: string;
  location: string | null;
  attendeeCount: number | null;
  agenda: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSafetyEventInput {
  eventType: SafetyEventType;
  title: string;
  description: string;
  occurredAt: string;
  severity?: SafetySeverity;
  location?: string;
  involvedParties?: string;
  assignedTo?: string;
  immediateAction?: string;
  notes?: string;
}

// ── Quality ───────────────────────────────────────────────────────────────────
export type QualityInspectionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type QualityInspectionResult = 'PASS' | 'PASS_WITH_CONDITIONS' | 'FAIL';
export type QualityDeficiencyStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DISPUTED' | 'CANCELLED';
export type QualitySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CorrectiveActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'CANCELLED';
export type CorrectiveActionSourceType = 'QUALITY_DEFICIENCY' | 'SAFETY_INCIDENT' | 'SAFETY_OBSERVATION';

export interface QualityInspectionDTO {
  id: string;
  organizationId: string;
  projectId: string;
  inspectionType: string;
  status: QualityInspectionStatus;
  result: QualityInspectionResult | null;
  scheduledDate: string | null;
  performedDate: string | null;
  inspectorMemberId: string | null;
  location: string | null;
  findings: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualityDeficiencyDTO {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  status: QualityDeficiencyStatus;
  severity: QualitySeverity | null;
  inspectionId: string | null;
  description: string | null;
  responsibleMemberId: string | null;
  dueDate: string | null;
  location: string | null;
  notes: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CorrectiveActionDTO {
  id: string;
  organizationId: string;
  projectId: string;
  sourceType: CorrectiveActionSourceType;
  sourceId: string;
  title: string;
  status: CorrectiveActionStatus;
  description: string | null;
  assignedTo: string | null;
  dueDate: string | null;
  notes: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Compliance ────────────────────────────────────────────────────────────────
export type PermitStatus = 'PENDING' | 'APPLIED' | 'ISSUED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'CANCELLED';
export type ComplianceRecordStatus = 'PENDING' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'CANCELLED' | 'VERIFIED';
export type ComplianceInspectionResult = 'PASS' | 'PASS_WITH_CONDITIONS' | 'FAIL' | 'INCONCLUSIVE';

export interface PermitDTO {
  id: string;
  organizationId: string;
  projectId: string;
  permitType: string;
  status: PermitStatus;
  referenceNumber: string | null;
  issuingAuthority: string | null;
  responsibleMemberId: string | null;
  issueDate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceRecordDTO {
  id: string;
  organizationId: string;
  projectId: string;
  requirementType: string;
  status: ComplianceRecordStatus;
  subjectType: string | null;
  subjectId: string | null;
  responsibleMemberId: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  verificationRef: string | null;
  notes: string | null;
  verifiedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceInspectionDTO {
  id: string;
  organizationId: string;
  projectId: string;
  inspectionType: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  result: ComplianceInspectionResult | null;
  scheduledDate: string | null;
  performedDate: string | null;
  findings: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpiringItemDTO {
  entityType: 'document' | 'permit' | 'compliance_record';
  entityId: string;
  title: string;
  expiryDate: string;
  daysUntilExpiry: number;
}
