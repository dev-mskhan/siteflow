// apps/server/tests/helpers/ai/ai-fixtures.ts
// Reusable test fixtures and polling utilities for SiteFlow AI layer test suites.

import { postgres } from '@siteflow/database';
import { getDb } from '../../../src/lib/db/index.js';
import { projects, roles } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { serverEnv } from '../../../src/config/env.js';
import { createVerifiedUser } from '../fixtures.js';
import { OrganizationService } from '../../../src/modules/organization/organization.service.js';
import type { AgentRunStatus } from '../../../src/modules/ai/core/types.js';
import type { FastifyInstance } from 'fastify';
import type { OrgDTO } from '../../../src/modules/organization/organization.types.js';

let sharedSql: ReturnType<typeof postgres> | null = null;

export function getTestSql(): ReturnType<typeof postgres> {
  if (!sharedSql) {
    sharedSql = postgres(serverEnv.DATABASE_URL, { max: 5 });
  }
  return sharedSql;
}

export async function closeTestSql(): Promise<void> {
  if (sharedSql) {
    await sharedSql.end();
    sharedSql = null;
  }
}

export interface OrgWithAiPermissionsResult {
  user: { id: string; email: string };
  token: string;
  orgId: string;
  org: OrgDTO;
  adminRoleId: string;
}

/**
 * Creates a verified user and an active organization with all ai.* permissions
 * granted to the user via the Organization Admin role.
 */
export async function createOrgWithAiPermissions(
  _app?: FastifyInstance,
  orgNameOverride?: string,
): Promise<OrgWithAiPermissionsResult> {
  const { user, token } = await createVerifiedUser();
  const orgName = orgNameOverride ?? `AI Test Org ${crypto.randomUUID().slice(0, 8)}`;

  const orgService = new OrganizationService();
  const org = await orgService.createOrganization(user.id, { name: orgName });

  const db = getDb();
  const orgRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.organizationId, org.id));

  const adminRole = orgRoles.find((r) => r.name === 'Organization Admin');
  if (!adminRole) {
    throw new Error(`Organization Admin role was not found for created org ${org.id}`);
  }

  return {
    user,
    token,
    orgId: org.id,
    org,
    adminRoleId: adminRole.id,
  };
}

/**
 * Creates an active project scoped to the specified organization.
 */
export async function createProjectForOrg(
  orgId: string,
  createdBy?: string,
  name?: string,
) {
  const db = getDb();
  const id = crypto.randomUUID();
  const projectNumber = `PRJ-${id.slice(0, 6).toUpperCase()}`;

  const inserted = await db
    .insert(projects)
    .values({
      id,
      organizationId: orgId,
      projectNumber,
      name: name ?? `AI Test Project ${id.slice(0, 8)}`,
      status: 'ACTIVE',
      currency: 'USD',
      createdBy: createdBy ?? null,
    })
    .returning();

  return inserted[0]!;
}

/**
 * Polls app.agent_runs using raw SQL until the target status is reached,
 * or throws an informative timeout/failure error.
 */
export async function waitForRunStatus(
  runId: string,
  targetStatus: AgentRunStatus,
  timeoutMs = 15000,
  pollIntervalMs = 150,
) {
  const sql = getTestSql();
  const startTime = Date.now();
  let lastStatus: string | null = null;
  let lastError: string | null = null;
  let lastRow: any = null;

  while (Date.now() - startTime < timeoutMs) {
    const rows = await sql`
      SELECT
        id,
        organization_id,
        agent,
        channel,
        status,
        input_snapshot,
        output,
        error,
        tokens_in,
        tokens_out,
        cost_usd,
        started_at,
        finished_at,
        trace_id
      FROM app.agent_runs
      WHERE id = ${runId}
    `;

    if (rows.length > 0) {
      lastRow = rows[0];
      lastStatus = lastRow.status;
      lastError = lastRow.error;

      if (lastStatus === targetStatus) {
        return lastRow;
      }

      // If run already reached an unexpected terminal state, fail early with clear diagnostic
      if (
        (lastStatus === 'FAILED' && targetStatus !== 'FAILED') ||
        (lastStatus === 'CANCELLED' && targetStatus !== 'CANCELLED')
      ) {
        throw new Error(
          `Run ${runId} entered unexpected terminal status "${lastStatus}" (waiting for "${targetStatus}"). Error: ${lastError}`,
        );
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for run ${runId} to reach status "${targetStatus}". ` +
      `Last status: "${lastStatus}", last error: "${lastError}"`,
  );
}
