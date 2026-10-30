// apps/server/tests/integration/ai/tenant-isolation.test.ts
//
// Chunk 8: Cross-org / cross-project tenant isolation and endpoint boundary security.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import type PgBoss from 'pg-boss';
import { createTestApp } from '../../helpers/test-app.js';
import '../../../src/modules/ai/index.js'; // register all tool definitions
import {
  createOrgWithAiPermissions,
  waitForRunStatus,
  getTestSql,
  closeTestSql,
} from '../../helpers/ai/ai-fixtures.js';
import { installScriptedModel, clearScriptedModel } from '../../helpers/ai/fake-model.js';
import { assertTenantScope, buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import { startQueue, stopQueue } from '../../../src/lib/queue/index.js';
import { registerAgentRunWorkers } from '../../../src/modules/ai/workers/agent-run.worker.js';

let app: FastifyInstance;
let boss: PgBoss;

beforeAll(async () => {
  app = await createTestApp();
  boss = await startQueue();
  await registerAgentRunWorkers(boss);
  installScriptedModel([]);
}, 120000);

afterAll(async () => {
  clearScriptedModel();
  try {
    await stopQueue();
  } catch {
    // ignore cleanup errors
  }
  if (app) {
    await app.close();
  }
  await closeTestSql();
});

describe('Tenant Isolation & Cross-Org Security', () => {
  // ── 1. assertTenantScope unit tests ──────────────────────────────────────────

  it('1a. assertTenantScope allows data with matching organizationId', () => {
    const ctx = buildRunContext({
      id: 'run-1',
      organizationId: 'org-a',
      agent: 'echo',
      createdBy: 'user-1',
    });

    expect(() =>
      assertTenantScope(ctx, { organizationId: 'org-a' }, 'test_tool'),
    ).not.toThrow();
  });

  it('1b. assertTenantScope throws TenantLeakError on mismatched organizationId', async () => {
    const ctx = buildRunContext({
      id: 'run-2',
      organizationId: 'org-a',
      agent: 'echo',
      createdBy: 'user-1',
    });

    const { TenantLeakError } = await import('../../../src/modules/ai/core/errors.js');
    expect(() =>
      assertTenantScope(ctx, { organizationId: 'org-b' }, 'test_tool'),
    ).toThrow(TenantLeakError);
  });

  it('1c. assertTenantScope skips null/undefined data (no false positives)', () => {
    const ctx = buildRunContext({
      id: 'run-3',
      organizationId: 'org-a',
      agent: 'echo',
      createdBy: 'user-1',
    });

    expect(() => assertTenantScope(ctx, null, 'test_tool')).not.toThrow();
    expect(() => assertTenantScope(ctx, undefined, 'test_tool')).not.toThrow();
  });

  it('1d. assertTenantScope checks project scope when both ctx and data have projectId', async () => {
    const ctx = buildRunContext({
      id: 'run-4',
      organizationId: 'org-a',
      projectId: 'project-1',
      agent: 'echo',
      createdBy: 'user-1',
    });

    const { TenantLeakError } = await import('../../../src/modules/ai/core/errors.js');

    // Same org, different project → should throw
    expect(() =>
      assertTenantScope(ctx, { organizationId: 'org-a', projectId: 'project-2' }, 'test_tool'),
    ).toThrow(TenantLeakError);

    // Same org, same project → should pass
    expect(() =>
      assertTenantScope(ctx, { organizationId: 'org-a', projectId: 'project-1' }, 'test_tool'),
    ).not.toThrow();
  });

  it('1e. assertTenantScope only checks shallow data.organizationId (does not recurse into arrays)', () => {
    const ctx = buildRunContext({
      id: 'run-5',
      organizationId: 'org-a',
      agent: 'echo',
      createdBy: 'user-1',
    });

    // A top-level object with matching org — passes even if nested array data belongs to another org.
    // This documents the known limitation: assertTenantScope is a shallow top-level guard.
    expect(() =>
      assertTenantScope(ctx, { organizationId: 'org-a', items: [{ organizationId: 'org-b' }] } as any, 'test_tool'),
    ).not.toThrow();
  });

  // ── 2. Cross-tenant HTTP endpoint authorization ───────────────────────────────

  it(
    '2a. user from Org A cannot read a run belonging to Org B (404)',
    async () => {
      const orgA = await createOrgWithAiPermissions(app);
      const orgB = await createOrgWithAiPermissions(app);
      const sql = getTestSql();

      // Create a run in Org B
      const runId = crypto.randomUUID();
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by)
        VALUES (${runId}, ${orgB.orgId}, 'echo', 'USER', 'SUCCEEDED', ${orgB.user.id});
      `;

      // User from Org A tries to read it (using Org A's org scoped URL)
      const readRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgA.orgId}/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${orgA.token}` },
      });

      // Should 404 (run doesn't belong to Org A)
      expect(readRes.statusCode).toBe(404);
    },
    30000,
  );

  it(
    '2b. user from Org A cannot cancel a run belonging to Org B (404)',
    async () => {
      const orgA = await createOrgWithAiPermissions(app);
      const orgB = await createOrgWithAiPermissions(app);
      const sql = getTestSql();

      const runId = crypto.randomUUID();
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by)
        VALUES (${runId}, ${orgB.orgId}, 'echo', 'USER', 'QUEUED', ${orgB.user.id});
      `;

      const cancelRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgA.orgId}/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${orgA.token}` },
      });

      // Org A's scope doesn't include this run → 404
      expect(cancelRes.statusCode).toBe(404);

      // Verify run status was NOT changed
      const rows = await sql`SELECT status FROM app.agent_runs WHERE id = ${runId}`;
      expect(rows[0].status).toBe('QUEUED');
    },
    30000,
  );

  it(
    '2c. user from Org A cannot approve an approval belonging to Org B (404)',
    async () => {
      const orgA = await createOrgWithAiPermissions(app);
      const orgB = await createOrgWithAiPermissions(app);
      const sql = getTestSql();

      // Create a run + approval in Org B
      const runId = crypto.randomUUID();
      const approvalId = crypto.randomUUID();
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by)
        VALUES (${runId}, ${orgB.orgId}, 'echo-approval', 'USER', 'AWAITING_APPROVAL', ${orgB.user.id});
      `;
      // Use raw SQL to insert a valid approval (PENDING, with expires_at in the future)
      await sql`
        INSERT INTO app.agent_approvals (id, run_id, organization_id, proposal_type, proposal, expires_at)
        VALUES (${approvalId}, ${runId}, ${orgB.orgId}, 'TEST', '{}', NOW() + INTERVAL '1 hour');
      `;

      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgA.orgId}/ai/approvals/${approvalId}/approve`,
        headers: {
          authorization: `Bearer ${orgA.token}`,
          'content-type': 'application/json',
        },
        payload: {},
      });

      // Approval belongs to Org B, Org A user can't access it via Org A's namespace
      expect(approveRes.statusCode).toBe(404);
    },
    30000,
  );

  // ── 3. Run listing is scoped to the requesting org ────────────────────────────

  it(
    '3. listing runs only returns runs belonging to the requesting org',
    async () => {
      const orgA = await createOrgWithAiPermissions(app);
      const orgB = await createOrgWithAiPermissions(app);
      const sql = getTestSql();

      // Create a run in Org B
      const runIdB = crypto.randomUUID();
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by)
        VALUES (${runIdB}, ${orgB.orgId}, 'echo', 'USER', 'SUCCEEDED', ${orgB.user.id});
      `;

      // Create a run in Org A via HTTP
      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgA.orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${orgA.token}`,
          'content-type': 'application/json',
        },
        payload: { agent: 'echo', input: {} },
      });
      const runIdA = postRes.json().data.runId;
      await waitForRunStatus(runIdA, 'SUCCEEDED', 30000);

      // List runs for Org A
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgA.orgId}/ai/runs`,
        headers: { authorization: `Bearer ${orgA.token}` },
      });
      expect(listRes.statusCode).toBe(200);
      const runs = (listRes.json().data.runs ?? listRes.json().data) as Array<{ id: string }>;

      // Should contain Org A's run but NOT Org B's run
      const runIds = runs.map((r) => r.id);
      expect(runIds).toContain(runIdA);
      expect(runIds).not.toContain(runIdB);
    },
    60000,
  );
});
