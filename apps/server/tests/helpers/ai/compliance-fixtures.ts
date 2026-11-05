// apps/server/tests/helpers/ai/compliance-fixtures.ts
//
// Seed helpers for the compliance agent test suite.
// Creates quality inspections, deficiencies, corrective actions,
// safety events, permits, and compliance records.
//
// Design rules:
//  - All IDs and status values are CONSTANTS — tests assert these, never agent output.
//  - Uses service singletons (same as prod) not raw SQL.
//  - Two isolated orgs to enable cross-tenant tests.

import { createOrgWithAiPermissions, createProjectForOrg } from './ai-fixtures.js';
import { qualityService } from '../../../src/modules/project/quality/quality.service.js';
import { safetyService } from '../../../src/modules/project/safety/safety.service.js';
import { complianceService } from '../../../src/modules/project/compliance/compliance.service.js';
import type { OrgWithAiPermissionsResult } from './ai-fixtures.js';
import type { FastifyInstance } from 'fastify';

// ── Known constants ───────────────────────────────────────────────────────────

export const SEED_COMPLIANCE = {
  name: 'Compliance Test Project Alpha',

  // Quality inspection — COMPLETED/FAIL (triggers deficiency)
  inspection1: {
    inspectionType: 'Structural Concrete Inspection',
    status: 'COMPLETED',
    result: 'FAIL',
  },

  // Quality deficiency — OPEN/HIGH
  deficiency1: {
    title: 'Concrete beam reinforcement does not meet spec',
    severity: 'HIGH',
    status: 'OPEN',
  },

  // Corrective action — IN_PROGRESS
  action1: {
    title: 'Rework beam reinforcement to ASTM A615 Grade 60',
    status: 'IN_PROGRESS',
  },

  // Safety event — INCIDENT/CRITICAL
  safetyEvent1: {
    eventType: 'INCIDENT',
    title: 'Worker fall from scaffolding',
    severity: 'CRITICAL',
    status: 'UNDER_INVESTIGATION',
  },

  // Safety event — NEAR_MISS/LOW (closed)
  safetyEvent2: {
    eventType: 'NEAR_MISS',
    title: 'Near-miss with forklift',
    severity: 'LOW',
    status: 'CLOSED',
  },

  // Permit — ACTIVE
  permit1: {
    permitType: 'Building Permit',
    referenceNumber: 'BLD-2026-0417',
    issuingAuthority: 'City Planning Department',
    status: 'ACTIVE',
    expiryDate: '2027-06-30',
  },

  // Permit — EXPIRED
  permit2: {
    permitType: 'Crane Operation Permit',
    referenceNumber: 'CRANE-2026-0022',
    issuingAuthority: 'WorkSafe Authority',
    status: 'EXPIRED',
    expiryDate: '2026-09-30',
  },

  // Compliance record — ACTIVE
  record1: {
    requirementType: 'Contractor Insurance Certificate',
    status: 'ACTIVE',
    expiryDate: '2027-03-31',
  },
} as const;

export const SEED_COMPLIANCE_ORG_B = {
  name: 'Compliance Test Project Beta',
} as const;

// ── Fixture types ─────────────────────────────────────────────────────────────

export interface ComplianceOrgAFixture extends OrgWithAiPermissionsResult {
  project: { id: string };
  inspections: { inspection1: { id: string } };
  deficiencies: { deficiency1: { id: string } };
  actions: { action1: { id: string } };
  safetyEvents: { event1: { id: string }; event2: { id: string } };
  permits: { permit1: { id: string }; permit2: { id: string } };
  records: { record1: { id: string } };
}

export interface ComplianceOrgBFixture extends OrgWithAiPermissionsResult {
  project: { id: string };
}

export interface ComplianceFixtures {
  orgA: ComplianceOrgAFixture;
  orgB: ComplianceOrgBFixture;
}

// ── buildFinalAnswer ──────────────────────────────────────────────────────────

export function buildFinalAnswer(opts: {
  narrative: string;
  figures?: Array<{
    label: string;
    value: string | number;
    unit?: string;
    source?: { toolName: string; resultPath: string };
  }>;
  summary: string;
  toolName: string;
  snippet: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  missingData?: string[];
  documentId?: string;
  pageReference?: string;
}): string {
  return JSON.stringify({
    answer: {
      narrative: opts.narrative,
      figures: opts.figures ?? [],
      confidence: opts.confidence ?? 'HIGH',
      missingData: opts.missingData,
    },
    summary: opts.summary.slice(0, 500),
    citations: [
      {
        toolName: opts.toolName,
        snippet: opts.snippet,
        ...(opts.documentId ? { documentId: opts.documentId, versionNumber: 1, pageReference: opts.pageReference ?? null } : {}),
      },
    ],
  });
}

// ── seedComplianceFixtures ────────────────────────────────────────────────────

export async function seedComplianceFixtures(
  _app?: FastifyInstance,
): Promise<ComplianceFixtures> {
  const orgAResult = await createOrgWithAiPermissions(_app, 'Compliance Org Alpha');
  const orgBResult = await createOrgWithAiPermissions(_app, 'Compliance Org Beta');

  const projectA = await createProjectForOrg(
    orgAResult.orgId,
    orgAResult.user.id,
    SEED_COMPLIANCE.name,
  );

  const projectB = await createProjectForOrg(
    orgBResult.orgId,
    orgBResult.user.id,
    SEED_COMPLIANCE_ORG_B.name,
  );

  const scope = { organizationId: orgAResult.orgId, projectId: projectA.id };
  const actor = orgAResult.user.id;

  // ── Quality Inspection ────────────────────────────────────────────────────
  const inspection1 = await qualityService.create(actor, scope, 'inspection', {
    inspectionType: SEED_COMPLIANCE.inspection1.inspectionType,
  });
  await qualityService.startInspection(actor, scope, inspection1.id);
  await qualityService.completeInspection(actor, scope, inspection1.id, {
    result: 'FAIL',
    performedDate: new Date().toISOString().slice(0, 10),
  });

  // ── Quality Deficiency ────────────────────────────────────────────────────
  const deficiency1 = await qualityService.create(actor, scope, 'deficiency', {
    title: SEED_COMPLIANCE.deficiency1.title,
    severity: 'HIGH',
    inspectionId: inspection1.id,
  });
  // Transition to IN_PROGRESS so we can create corrective action
  await qualityService.update(actor, scope, 'deficiency', deficiency1.id, { status: 'IN_PROGRESS' });

  // ── Corrective Action ─────────────────────────────────────────────────────
  const action1 = await qualityService.create(actor, scope, 'action', {
    title: SEED_COMPLIANCE.action1.title,
    sourceType: 'QUALITY_DEFICIENCY',
    sourceId: deficiency1.id,
  });
  await qualityService.update(actor, scope, 'action', action1.id, { status: 'IN_PROGRESS' });

  // ── Safety Events ─────────────────────────────────────────────────────────
  const event1 = await safetyService.createEvent(actor, scope, {
    eventType: 'INCIDENT',
    title: SEED_COMPLIANCE.safetyEvent1.title,
    description: 'Worker fell approximately 3 metres from scaffolding level 2.',
    severity: 'CRITICAL',
    occurredAt: new Date() as unknown as string,
    location: 'Level 2 Scaffolding — Grid E5',
  });
  await safetyService.investigate(actor, scope, event1.id, {
    rootCause: 'Incomplete safety harness attachment',
    immediateAction: 'Area secured, worker taken to hospital',
  });

  const event2 = await safetyService.createEvent(actor, scope, {
    eventType: 'NEAR_MISS',
    title: SEED_COMPLIANCE.safetyEvent2.title,
    description: 'Forklift passed within 0.5m of pedestrian in undesignated zone.',
    severity: 'LOW',
    occurredAt: new Date(Date.now() - 7 * 86400000) as unknown as string,
    location: 'Ground Floor Loading Dock',
  });
  await safetyService.investigate(actor, scope, event2.id, {
    rootCause: 'Pedestrian walked outside designated walkway',
    immediateAction: 'Zone remarked, pedestrian briefed',
  });
  await safetyService.updateEvent(actor, scope, event2.id, {
    status: 'CORRECTIVE_ACTION_REQUIRED',
    rootCause: 'Pedestrian walked outside designated walkway',
  });
  await safetyService.closeEvent(actor, scope, event2.id, {
    notes: 'Walkway markings renewed, toolbox talk conducted',
  });

  // ── Permits ───────────────────────────────────────────────────────────────
  const permit1 = await complianceService.create(actor, scope, 'permit', {
    permitType: SEED_COMPLIANCE.permit1.permitType,
    referenceNumber: SEED_COMPLIANCE.permit1.referenceNumber,
    issuingAuthority: SEED_COMPLIANCE.permit1.issuingAuthority,
    issueDate: '2026-07-01',
    effectiveDate: '2026-07-01',
    expiryDate: SEED_COMPLIANCE.permit1.expiryDate,
  });
  await complianceService.transitionPermit(actor, scope, permit1.id, 'APPLIED');
  await complianceService.transitionPermit(actor, scope, permit1.id, 'ISSUED');
  await complianceService.transitionPermit(actor, scope, permit1.id, 'ACTIVE');

  const permit2 = await complianceService.create(actor, scope, 'permit', {
    permitType: SEED_COMPLIANCE.permit2.permitType,
    referenceNumber: SEED_COMPLIANCE.permit2.referenceNumber,
    issuingAuthority: SEED_COMPLIANCE.permit2.issuingAuthority,
    issueDate: '2026-04-01',
    effectiveDate: '2026-04-01',
    expiryDate: SEED_COMPLIANCE.permit2.expiryDate,
  });
  await complianceService.transitionPermit(actor, scope, permit2.id, 'APPLIED');
  await complianceService.transitionPermit(actor, scope, permit2.id, 'ISSUED');
  await complianceService.transitionPermit(actor, scope, permit2.id, 'ACTIVE');
  // Note: EXPIRED transition isn't in the state machine — status is set externally by the expiry scanner.
  // For tests we'll leave it at ACTIVE and test EXPIRED via listing with status filter separately.

  // ── Compliance Record ─────────────────────────────────────────────────────
  const record1 = await complianceService.create(actor, scope, 'record', {
    requirementType: SEED_COMPLIANCE.record1.requirementType,
    expiryDate: SEED_COMPLIANCE.record1.expiryDate,
  });
  await complianceService.update(actor, scope, 'record', record1.id, { status: 'ACTIVE' });

  return {
    orgA: {
      ...orgAResult,
      project: { id: projectA.id },
      inspections: { inspection1: { id: inspection1.id } },
      deficiencies: { deficiency1: { id: deficiency1.id } },
      actions: { action1: { id: action1.id } },
      safetyEvents: { event1: { id: event1.id }, event2: { id: event2.id } },
      permits: { permit1: { id: permit1.id }, permit2: { id: permit2.id } },
      records: { record1: { id: record1.id } },
    },
    orgB: {
      ...orgBResult,
      project: { id: projectB.id },
    },
  };
}
