// apps/server/tests/helpers/ai/cost-financial-fixtures.ts
//
// Seed helpers and known-value constants for the cost-financial agent test suites.
//
// Design rules:
//  - All numeric seed values are CONSTANTS here — tests assert against these, never
//    against values returned by the agent. The agent can't set the ground truth.
//  - Use createOrgWithAiPermissions (which creates an Org Admin user with project:read)
//    so cost tools pass the RBAC check.
//  - Use createProjectForOrg (Drizzle ORM) to create projects — matches ai-fixtures pattern.
//  - No raw SQL inserts for domain data — use the Drizzle helpers that already exist.

import { getDb } from '../../../src/lib/db/index.js';
import { createOrgWithAiPermissions, createProjectForOrg } from './ai-fixtures.js';
import type { OrgWithAiPermissionsResult } from './ai-fixtures.js';
import type { FastifyInstance } from 'fastify';

// ── Known output constants ────────────────────────────────────────────────────
// These match what the fake model should echo back in its scripted response.
// Tests assert against these constants — never against the agent's live output.

/** Org A: a project that is under budget with simple USD figures. */
export const SEED_PROJECT_A = {
  name: 'CF Test Project Alpha',
  currency: 'USD',
  budgetOriginal: '1000000.00',
  budgetApprovedChanges: '50000.00',
  budgetRevised: '1050000.00',
  actualCost: '780000.00',
  committedCost: '900000.00',
  variance: '150000.00', // revised − committed
} as const;

/** Org B: separate project used only for cross-tenant isolation tests. */
export const SEED_PROJECT_B = {
  name: 'CF Test Project Beta',
  currency: 'USD',
  budgetOriginal: '500000.00',
} as const;

// ── Fixture result shapes ─────────────────────────────────────────────────────

export interface OrgAFixture extends OrgWithAiPermissionsResult {
  project: { id: string };
}

export interface OrgBFixture extends OrgWithAiPermissionsResult {
  project: { id: string };
}

export interface CostFinancialFixtures {
  orgA: OrgAFixture;
  orgB: OrgBFixture;
}

// ── Helper: build the valid JSON the fake model should emit as its final turn ─

/**
 * Returns the JSON string that the scripted fake model should return as its final
 * text response for a cost-financial run.  The values come from SEED_PROJECT_A so
 * tests can assert specific fields.
 */
export function buildFinalAnswer(opts: {
  narrative: string;
  figures?: Array<{ label: string; value: string | number; currency?: string }>;
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
    summary: opts.summary.slice(0, 500),
    citations: [{ toolName: opts.toolName, snippet: opts.snippet }],
  });
}

// ── Main seed function ────────────────────────────────────────────────────────

/**
 * Creates two isolated orgs (A and B), each with one active project.
 * Both org admins have project:read (granted via Organization Admin role in migrations).
 * Call once in beforeAll and share across tests — the per-test fake model reset
 * (clearScriptedModel) keeps tests independent.
 */
export async function seedCostFinancialFixtures(
  app?: FastifyInstance,
): Promise<CostFinancialFixtures> {
  // createOrgWithAiPermissions creates a verified user + org whose admin role
  // already holds project:read, so cost-financial tools will pass RBAC checks.
  const orgAResult = await createOrgWithAiPermissions(app, 'CF Org Alpha');
  const orgBResult = await createOrgWithAiPermissions(app, 'CF Org Beta');

  const projectA = await createProjectForOrg(
    orgAResult.orgId,
    orgAResult.user.id,
    SEED_PROJECT_A.name,
  );

  const projectB = await createProjectForOrg(
    orgBResult.orgId,
    orgBResult.user.id,
    SEED_PROJECT_B.name,
  );

  return {
    orgA: { ...orgAResult, project: { id: projectA.id } },
    orgB: { ...orgBResult, project: { id: projectB.id } },
  };
}
