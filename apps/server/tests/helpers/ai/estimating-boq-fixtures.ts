// apps/server/tests/helpers/ai/estimating-boq-fixtures.ts
//
// Seed helpers for the estimating-BOQ agent test suite.
// Creates BOQs, estimates, takeoff sheets, and cost codes.
//
// Design rules:
//  - All IDs/values are CONSTANTS — tests assert these, never agent output.
//  - Uses service singletons (same as prod) not raw SQL.
//  - Two isolated orgs for cross-tenant tests.

import { createOrgWithAiPermissions, createProjectForOrg } from './ai-fixtures.js';
import { projectBoqService } from '../../../src/modules/project/boq/boq.service.js';
import { projectEstimateService } from '../../../src/modules/project/estimate/estimate.service.js';
import { projectTakeoffService } from '../../../src/modules/project/takeoff/takeoff.service.js';
import { projectCostCodeService } from '../../../src/modules/project/cost-codes/project-cost-code.service.js';
import type { OrgWithAiPermissionsResult } from './ai-fixtures.js';
import type { FastifyInstance } from 'fastify';

// ── Constants ─────────────────────────────────────────────────────────────────

export const SEED_ESTIMATING = {
  name: 'Estimating Test Project Alpha',
  currency: 'USD',

  costCodes: {
    concrete: { code: 'CC-0330', description: 'Concrete work' },
    steel:    { code: 'CC-0512', description: 'Structural steel' },
    formwork: { code: 'CC-0310', description: 'Formwork' },
  },

  boq: {
    title: 'Foundation Works BOQ',
    description: 'BOQ for reinforced concrete foundations',
    currencyCode: 'USD',
    // Known item keys and values seeded via CSV import are NOT used here —
    // we create the BOQ in DRAFT status only (no CSV import in tests).
  },

  estimate: {
    title: 'Foundation Works Estimate',
    description: 'Cost estimate for concrete foundation package',
  },

  takeoffSheet: {
    title: 'Foundation Slab Takeoff',
    description: 'Takeoff measurements for ground floor concrete slab',
  },
} as const;

export const SEED_ESTIMATING_ORG_B = {
  name: 'Estimating Test Project Beta',
} as const;

// ── Fixture types ─────────────────────────────────────────────────────────────

export interface EstimatingOrgAFixture extends OrgWithAiPermissionsResult {
  project: { id: string };
  costCodes: {
    concrete: { id: string; code: string };
    steel:    { id: string; code: string };
    formwork: { id: string; code: string };
  };
  boq: { id: string; boqNumber: number; currentRevisionId?: string };
  estimate: { id: string };
  takeoffSheet: { id: string };
}

export interface EstimatingOrgBFixture extends OrgWithAiPermissionsResult {
  project: { id: string };
}

export interface EstimatingBoqFixtures {
  orgA: EstimatingOrgAFixture;
  orgB: EstimatingOrgBFixture;
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
  draft?: Array<{
    description: string;
    unit: string;
    quantity: string;
    costCodeId?: string;
    costCode?: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    source: { toolName: string; resultPath: string; snippet: string };
  }>;
  validationIssues?: Array<{ lineIndex: number; issue: string; severity: 'ERROR' | 'WARNING' }>;
  summary: string;
  toolName: string;
  snippet: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  missingData?: string[];
}): string {
  return JSON.stringify({
    answer: {
      narrative: opts.narrative,
      figures: opts.figures ?? [],
      confidence: opts.confidence ?? 'HIGH',
      missingData: opts.missingData,
    },
    draft: opts.draft ?? [],
    validationIssues: opts.validationIssues ?? [],
    summary: opts.summary.slice(0, 500),
    citations: [{ toolName: opts.toolName, snippet: opts.snippet }],
  });
}

// ── seedEstimatingBoqFixtures ─────────────────────────────────────────────────

export async function seedEstimatingBoqFixtures(
  _app?: FastifyInstance,
): Promise<EstimatingBoqFixtures> {
  const orgAResult = await createOrgWithAiPermissions(_app, 'Estimating Org Alpha');
  const orgBResult = await createOrgWithAiPermissions(_app, 'Estimating Org Beta');

  const projectA = await createProjectForOrg(
    orgAResult.orgId,
    orgAResult.user.id,
    SEED_ESTIMATING.name,
  );

  const projectB = await createProjectForOrg(
    orgBResult.orgId,
    orgBResult.user.id,
    SEED_ESTIMATING_ORG_B.name,
  );

  const orgId = orgAResult.orgId;
  const projectId = projectA.id;
  const actor = orgAResult.user.id;
  const requestId = crypto.randomUUID();

  // ── Cost codes ─────────────────────────────────────────────────────────────
  const ccConcrete = await projectCostCodeService.createCostCode(actor, orgId, projectId, {
    code: SEED_ESTIMATING.costCodes.concrete.code,
    description: SEED_ESTIMATING.costCodes.concrete.description,
  });
  const ccSteel = await projectCostCodeService.createCostCode(actor, orgId, projectId, {
    code: SEED_ESTIMATING.costCodes.steel.code,
    description: SEED_ESTIMATING.costCodes.steel.description,
  });
  const ccFormwork = await projectCostCodeService.createCostCode(actor, orgId, projectId, {
    code: SEED_ESTIMATING.costCodes.formwork.code,
    description: SEED_ESTIMATING.costCodes.formwork.description,
  });

  // ── BOQ (DRAFT) ────────────────────────────────────────────────────────────
  const boq = await projectBoqService.create(
    { organizationId: orgId, projectId },
    {
      title: SEED_ESTIMATING.boq.title,
      description: SEED_ESTIMATING.boq.description,
      currencyCode: SEED_ESTIMATING.boq.currencyCode,
    },
    actor,
    requestId,
  );

  // Get the revision id from listRevisions
  const revisions = await projectBoqService.listRevisions(
    { organizationId: orgId, projectId },
    boq.id,
    { limit: 1 },
  );
  const currentRevisionId = revisions.items[0]?.id;

  // ── Estimate (DRAFT) ───────────────────────────────────────────────────────
  const estimate = await projectEstimateService.create(
    { organizationId: orgId, projectId },
    {
      title: SEED_ESTIMATING.estimate.title,
      description: SEED_ESTIMATING.estimate.description,
      terms: {
        overheadPercent: '10',
        contingencyPercent: '5',
        markupMode: 'NONE',
        markupPercent: '0',
        discountPercent: '0',
        taxPercent: '0',
      },
      sections: [
        {
          title: 'Concrete Work',
          lines: [
            {
              category: 'MATERIAL',
              description: 'Ready-mix concrete C30/37',
              unit: 'm3',
              quantity: '150',
              unitRate: '180.00',
              costCodeId: ccConcrete.id,
              resources: [],
            },
            {
              category: 'LABOR',
              description: 'Concrete placement and finishing',
              unit: 'hr',
              quantity: '80',
              unitRate: '45.00',
              costCodeId: ccConcrete.id,
              resources: [],
            },
          ],
        },
        {
          title: 'Structural Steel',
          lines: [
            {
              category: 'MATERIAL',
              description: 'Steel reinforcement bar Y16',
              unit: 'kg',
              quantity: '5000',
              unitRate: '1.20',
              costCodeId: ccSteel.id,
              resources: [],
            },
          ],
        },
      ],
    },
    actor,
    requestId,
  );

  // ── Takeoff sheet (DRAFT) ──────────────────────────────────────────────────
  const sheet = await projectTakeoffService.createSheet(
    { organizationId: orgId, projectId, actorUserId: actor, requestId },
    {
      title: SEED_ESTIMATING.takeoffSheet.title,
      description: SEED_ESTIMATING.takeoffSheet.description,
    },
  );

  return {
    orgA: {
      ...orgAResult,
      project: { id: projectId },
      costCodes: {
        concrete: { id: ccConcrete.id, code: ccConcrete.code },
        steel:    { id: ccSteel.id,    code: ccSteel.code    },
        formwork: { id: ccFormwork.id, code: ccFormwork.code },
      },
      boq: { id: boq.id, boqNumber: boq.boqNumber, currentRevisionId },
      estimate: { id: estimate.id },
      takeoffSheet: { id: sheet.id },
    },
    orgB: {
      ...orgBResult,
      project: { id: projectB.id },
    },
  };
}
