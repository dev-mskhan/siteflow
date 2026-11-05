// apps/server/src/modules/ai/tools/definitions/compliance.tools.ts
//
// READ-tier tools for the compliance agent.
// Wraps: QualityService, SafetyService, ComplianceService, ExpiryScannerService.
// All tools are READ — they never mutate state.

import { z } from 'zod';
import { registerTool } from '../tool-registry.js';
import { qualityService } from '../../../project/quality/quality.service.js';
import { safetyService } from '../../../project/safety/safety.service.js';
import { complianceService } from '../../../project/compliance/compliance.service.js';
import { expiryScannerService } from '../../../project/compliance/expiry-scanner.service.js';

// ── Shared schemas ────────────────────────────────────────────────────────────

const projectIdArg = z.string().uuid().describe('The UUID of the project.');
const cursorArg = z.string().optional().describe('Pagination cursor from a previous response.');
const limitArg = z.number().int().min(1).max(50).default(25)
  .describe('Max records to return (1–50, default 25).');

// ── 1. list_quality_inspections ───────────────────────────────────────────────

registerTool({
  name: 'list_quality_inspections',
  description:
    'Lists quality inspections for a project. ' +
    'Status values: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED. ' +
    'Each inspection includes type, scheduled date, inspector, and result (PASS/PASS_WITH_CONDITIONS/FAIL).',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional()
      .describe('Filter by inspection status.'),
    cursor: cursorArg,
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.quality.read',
  async execute({ projectId, status, cursor, limit }, ctx) {
    return qualityService.list(
      { organizationId: ctx.organizationId, projectId },
      'inspection',
      { status, cursor, limit: limit ?? 25 },
    );
  },
});

// ── 2. list_quality_deficiencies ──────────────────────────────────────────────

registerTool({
  name: 'list_quality_deficiencies',
  description:
    'Lists quality deficiencies (non-conformances) for a project. ' +
    'Status: OPEN, IN_PROGRESS, RESOLVED, CLOSED, DISPUTED, CANCELLED. ' +
    'Severity: LOW, MEDIUM, HIGH, CRITICAL.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DISPUTED', 'CANCELLED']).optional()
      .describe('Filter by deficiency status.'),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional()
      .describe('Filter by severity level.'),
    cursor: cursorArg,
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.quality.read',
  async execute({ projectId, status, severity, cursor, limit }, ctx) {
    return qualityService.list(
      { organizationId: ctx.organizationId, projectId },
      'deficiency',
      { status, severity, cursor, limit: limit ?? 25 },
    );
  },
});

// ── 3. list_corrective_actions ────────────────────────────────────────────────

registerTool({
  name: 'list_corrective_actions',
  description:
    'Lists corrective actions for a project. ' +
    'Status: OPEN, IN_PROGRESS, COMPLETED, VERIFIED, CANCELLED. ' +
    'sourceType identifies whether the action was raised from a quality deficiency or safety event.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED']).optional()
      .describe('Filter by corrective action status.'),
    sourceType: z.enum(['QUALITY_DEFICIENCY', 'SAFETY_INCIDENT', 'SAFETY_OBSERVATION']).optional()
      .describe('Filter by source type.'),
    cursor: cursorArg,
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.quality.read',
  async execute({ projectId, status, sourceType, cursor, limit }, ctx) {
    return qualityService.list(
      { organizationId: ctx.organizationId, projectId },
      'action',
      { status, sourceType, cursor, limit: limit ?? 25 },
    );
  },
});

// ── 4. list_safety_events ─────────────────────────────────────────────────────

registerTool({
  name: 'list_safety_events',
  description:
    'Lists safety events (incidents, near misses, unsafe conditions/acts, first aid) for a project. ' +
    'Status: REPORTED, UNDER_INVESTIGATION, CORRECTIVE_ACTION_REQUIRED, CORRECTIVE_ACTION_IN_PROGRESS, CLOSED. ' +
    'Severity: LOW, MEDIUM, HIGH, CRITICAL, FATALITY.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['REPORTED', 'UNDER_INVESTIGATION', 'CORRECTIVE_ACTION_REQUIRED', 'CORRECTIVE_ACTION_IN_PROGRESS', 'CLOSED']).optional()
      .describe('Filter by event status.'),
    eventType: z.enum(['INCIDENT', 'NEAR_MISS', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'FIRST_AID']).optional()
      .describe('Filter by event type.'),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATALITY']).optional()
      .describe('Filter by severity.'),
    cursor: cursorArg,
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.safety.read',
  async execute({ projectId, status, eventType, severity, cursor, limit }, ctx) {
    return safetyService.listEvents(
      { organizationId: ctx.organizationId, projectId },
      { status, eventType, severity, cursor, limit: limit ?? 25 },
    );
  },
});

// ── 5. list_permits ───────────────────────────────────────────────────────────

registerTool({
  name: 'list_permits',
  description:
    'Lists regulatory and construction permits for a project. ' +
    'Status: PENDING, APPLIED, ISSUED, ACTIVE, EXPIRED, REVOKED, CANCELLED. ' +
    'Each permit includes type, reference number, issuing authority, and expiry date.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['PENDING', 'APPLIED', 'ISSUED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'CANCELLED']).optional()
      .describe('Filter by permit status.'),
    cursor: cursorArg,
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.permit.read',
  async execute({ projectId, status, cursor, limit }, ctx) {
    return complianceService.list(
      { organizationId: ctx.organizationId, projectId },
      'permit',
      { status, cursor, limit: limit ?? 25 },
    );
  },
});

// ── 6. list_compliance_inspections ────────────────────────────────────────────

registerTool({
  name: 'list_compliance_inspections',
  description:
    'Lists compliance inspections for a project (e.g. third-party audits, regulatory checks). ' +
    'Status: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, FAILED. ' +
    'Result: PASS, PASS_WITH_CONDITIONS, FAIL, INCONCLUSIVE.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED']).optional()
      .describe('Filter by inspection status.'),
    cursor: cursorArg,
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.compliance_inspection.read',
  async execute({ projectId, status, cursor, limit }, ctx) {
    return complianceService.list(
      { organizationId: ctx.organizationId, projectId },
      'inspection',
      { status, cursor, limit: limit ?? 25 },
    );
  },
});

// ── 7. list_compliance_records ────────────────────────────────────────────────

registerTool({
  name: 'list_compliance_records',
  description:
    'Lists compliance requirement records for a project (certifications, licenses, insurance). ' +
    'Status: PENDING, ACTIVE, EXPIRING_SOON, EXPIRED, CANCELLED, VERIFIED.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['PENDING', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED', 'VERIFIED']).optional()
      .describe('Filter by record status.'),
    cursor: cursorArg,
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.compliance_record.read',
  async execute({ projectId, status, cursor, limit }, ctx) {
    return complianceService.list(
      { organizationId: ctx.organizationId, projectId },
      'record',
      { status, cursor, limit: limit ?? 25 },
    );
  },
});

// ── 8. get_expiring_items ─────────────────────────────────────────────────────

registerTool({
  name: 'get_expiring_items',
  description:
    'Returns all documents, permits, and compliance records expiring within a specified number of days. ' +
    'Use this to identify upcoming compliance obligations and permit renewals. ' +
    'Each item includes its type, title, expiry date, and days until expiry.',
  argsSchema: z.object({
    projectId: projectIdArg,
    days: z.number().int().min(1).max(90).default(30)
      .describe('Number of days ahead to check for expiring items (1–90, default 30).'),
    entityType: z.enum(['document', 'permit', 'compliance_record']).optional()
      .describe('Optionally filter to a specific entity type.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.compliance_record.read',
  async execute({ projectId, days, entityType }, ctx) {
    return expiryScannerService.listExpiring(
      { organizationId: ctx.organizationId, projectId },
      { days: days ?? 30, entityType },
    );
  },
});

// Note: read_okf_page and search_knowledge_base are registered in knowledge.tools.ts
// and included in the compliance agent's ALLOWED_TOOLS list.
