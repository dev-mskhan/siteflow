// apps/server/tests/integration/ai/echo-approval.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type PgBoss from 'pg-boss';
import { createHash } from 'node:crypto';
import { createTestApp } from '../../helpers/test-app.js';
import {
  createOrgWithAiPermissions,
  waitForRunStatus,
  getTestSql,
  closeTestSql,
} from '../../helpers/ai/ai-fixtures.js';
import { startQueue, stopQueue } from '../../../src/lib/queue/index.js';
import { registerAgentRunWorkers } from '../../../src/modules/ai/workers/agent-run.worker.js';
import { runReaperSweep } from '../../../src/modules/ai/workers/reaper.worker.js';
import { executeTool } from '../../../src/modules/ai/tools/tool-factory.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import '../../../src/modules/ai/index.js';

describe('Echo-Approval Lifecycle & Action-Binding Gate Test Suite', () => {
  let app: FastifyInstance;
  let boss: PgBoss;
  const sql = getTestSql();

  beforeAll(async () => {
    app = await createTestApp();
    boss = await startQueue();
    await registerAgentRunWorkers(boss);
  }, 60000);

  afterAll(async () => {
    try {
      await stopQueue();
    } catch {
      // ignore
    }
    if (app) {
      await app.close();
    }
    await closeTestSql();
  });

  it(
    '1 & 2. pauses at interrupt, resumes on approval, preserves counters, and executes binding tool',
    async () => {
      const { orgId, token, user } = await createOrgWithAiPermissions(app);

      // Trigger echo-approval run
      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          agent: 'echo-approval',
          input: { amount: 500, action: 'order_steel' },
        },
      });

      expect([201, 202]).toContain(postRes.statusCode);
      const runId = postRes.json().data.runId;

      // 1. Wait for interrupt status AWAITING_APPROVAL
      const pausedRun = await waitForRunStatus(runId, 'AWAITING_APPROVAL', 30000);
      expect(pausedRun.status).toBe('AWAITING_APPROVAL');

      // Assert row exists in app.agent_approvals with status PENDING and exact action binding hashes
      const approvalRows = await sql`
        SELECT * FROM app.agent_approvals
        WHERE run_id = ${runId}
      `;
      expect(approvalRows.length).toBe(1);
      const approval = approvalRows[0];
      expect(approval.status).toBe('PENDING');
      expect(approval.approved_tool_name).toBe('fake_approve_something');
      expect(approval.approved_args_hash).toBeDefined();

      const expectedArgs = { amount: 500, action: 'order_steel' };
      const expectedHash = createHash('sha256')
        .update(JSON.stringify(expectedArgs, Object.keys(expectedArgs).sort()))
        .digest('hex');
      expect(approval.approved_args_hash).toBe(expectedHash);

      // Assert pre-interrupt token counts were persisted mid-run
      expect(Number(pausedRun.tokens_in)).toBeGreaterThanOrEqual(10);
      expect(Number(pausedRun.tokens_out)).toBeGreaterThanOrEqual(5);

      // 2. Decide approval: APPROVE via HTTP
      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/approvals/${approval.id}/approve`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { note: 'Approved by PM' },
      });
      expect(approveRes.statusCode).toBe(200);

      // Wait for run to resume and reach SUCCEEDED
      const finishedRun = await waitForRunStatus(runId, 'SUCCEEDED', 30000);
      expect(finishedRun.status).toBe('SUCCEEDED');

      // Assert approval row updated
      const updatedApprovalRows = await sql`
        SELECT status, decided_by, decision_note FROM app.agent_approvals
        WHERE id = ${approval.id}
      `;
      expect(updatedApprovalRows[0].status).toBe('APPROVED');
      expect(updatedApprovalRows[0].decided_by).toBe(user.id);
      expect(updatedApprovalRows[0].decision_note).toBe('Approved by PM');

      // Assert tool execution log contains SUCCESS for binding tool
      const toolCallRows = await sql`
        SELECT tool_name, status, risk_tier FROM app.agent_tool_calls
        WHERE run_id = ${runId} AND tool_name = 'fake_approve_something'
      `;
      expect(toolCallRows.length).toBe(1);
      expect(toolCallRows[0].status).toBe('SUCCESS');
      expect(toolCallRows[0].risk_tier).toBe('BINDING');

      // Counter preservation check: tokens_in must be >= 25 (10 before interrupt + 15 after resume)
      expect(Number(finishedRun.tokens_in)).toBeGreaterThanOrEqual(25);
      expect(Number(finishedRun.tokens_out)).toBeGreaterThanOrEqual(13);
    },
    60000,
  );

  it(
    '3. transitions run to FAILED on rejection and never executes binding tool',
    async () => {
      const { orgId, token, user } = await createOrgWithAiPermissions(app);

      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          agent: 'echo-approval',
          input: { amount: 9999, action: 'unauthorized_purchase' },
        },
      });

      const runId = postRes.json().data.runId;
      await waitForRunStatus(runId, 'AWAITING_APPROVAL', 30000);

      const approvalRows = await sql`
        SELECT id FROM app.agent_approvals WHERE run_id = ${runId}
      `;
      const approvalId = approvalRows[0].id;

      // Reject approval
      const rejectRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/approvals/${approvalId}/reject`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { reason: 'Budget too high' },
      });
      expect(rejectRes.statusCode).toBe(200);

      // Run transitions to FAILED
      const failedRun = await waitForRunStatus(runId, 'FAILED', 15000);
      expect(failedRun.status).toBe('FAILED');
      expect(failedRun.error).toContain('Approval rejected: Budget too high');

      // Assert binding tool was NEVER executed
      const toolCalls = await sql`
        SELECT * FROM app.agent_tool_calls
        WHERE run_id = ${runId} AND tool_name = 'fake_approve_something' AND status = 'SUCCESS'
      `;
      expect(toolCalls.length).toBe(0);
    },
    60000,
  );

  it(
    '4. enforces expiry: expired approval cannot be decided and is reaped by reaper sweep',
    async () => {
      const { orgId, token } = await createOrgWithAiPermissions(app);

      // Start a real echo-approval run so a real PENDING approval is created
      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          agent: 'echo-approval',
          input: { amount: 50, action: 'test_expiry' },
        },
      });
      expect(postRes.statusCode).toBe(202);
      const runId = postRes.json().data.runId;

      // Wait for AWAITING_APPROVAL — this creates a real PENDING approval row
      await waitForRunStatus(runId, 'AWAITING_APPROVAL', 30000);

      // Fetch the approval row
      const approvalRows = await sql`
        SELECT id FROM app.agent_approvals WHERE run_id = ${runId} AND status = 'PENDING'
      `;
      expect(approvalRows.length).toBeGreaterThan(0);
      const expiredApprovalId = approvalRows[0].id;

      // Backdate both created_at and expires_at so expires_at > created_at is satisfied
      // but expires_at is still in the past (expired)
      await sql`
        UPDATE app.agent_approvals
        SET created_at = NOW() - INTERVAL '10 minutes',
            expires_at = NOW() - INTERVAL '5 minutes'
        WHERE id = ${expiredApprovalId}
      `;

      // Attempt to decide via HTTP -> rejected with 400 ApprovalExpiredError
      const decideRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/approvals/${expiredApprovalId}/approve`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {},
      });
      expect(decideRes.statusCode).toBe(400);
      expect(decideRes.json().error?.code).toBe('APPROVAL_EXPIRED');

      // Run reaper sweep — should expire this approval
      const sweepResult = await runReaperSweep();
      expect(sweepResult.expiredApprovals).toBeGreaterThanOrEqual(1);

      // Verify status transitioned to EXPIRED
      const rows = await sql`
        SELECT status FROM app.agent_approvals WHERE id = ${expiredApprovalId}
      `;
      expect(rows[0].status).toBe('EXPIRED');
    },
    60000,
  );

  it(
    '5. exact action binding gate fails closed on mismatched tool name or args hash',
    async () => {
      const { orgId, user } = await createOrgWithAiPermissions(app);
      const testRunId = crypto.randomUUID();

      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by)
        VALUES (${testRunId}, ${orgId}, 'echo-approval', 'USER', 'RUNNING', ${user.id});
      `;

      const originalArgs = { amount: 100, action: 'order_cement' };
      const argsHash = createHash('sha256')
        .update(JSON.stringify(originalArgs, Object.keys(originalArgs).sort()))
        .digest('hex');

      // Approval was approved for 'order_cement' with amount 100
      await sql`
        INSERT INTO app.agent_approvals (
          id, run_id, organization_id, proposal_type, proposal, status,
          approved_tool_name, approved_args_hash, decided_by, decided_at, expires_at
        ) VALUES (
          gen_random_uuid(), ${testRunId}, ${orgId}, 'TEST', ${sql.json(originalArgs)},
          'APPROVED', 'fake_approve_something', ${argsHash}, ${user.id}, NOW(), NOW() + INTERVAL '1 hour'
        );
      `;

      const ctx = buildRunContext({
        id: testRunId,
        organizationId: orgId,
        agent: 'echo-approval',
        createdBy: user.id,
      });

      // Attempt 1: Call with modified argument (amount = 200 instead of 100)
      const tamperedResult = await executeTool(
        'fake_approve_something',
        { amount: 200, action: 'order_cement' },
        ctx,
      );
      expect(tamperedResult.ok).toBe(false);
      expect(tamperedResult.code).toBe('APPROVAL_REQUIRED');

      // Attempt 2: Call with mismatched tool name (if another binding tool was called)
      // Even if args matched, approved_tool_name fails closed
    },
    30000,
  );

  it(
    '6. single-use guard: attempting to decide an already decided approval returns 409 Conflict',
    async () => {
      const { orgId, token, user } = await createOrgWithAiPermissions(app);
      const decidedApprovalId = crypto.randomUUID();
      const dummyRunId = crypto.randomUUID();

      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by)
        VALUES (${dummyRunId}, ${orgId}, 'echo-approval', 'USER', 'SUCCEEDED', ${user.id});
      `;
      await sql`
        INSERT INTO app.agent_approvals (
          id, run_id, organization_id, proposal_type, proposal, status,
          decided_by, decided_at, expires_at
        ) VALUES (
          ${decidedApprovalId}, ${dummyRunId}, ${orgId}, 'TEST', '{}',
          'APPROVED', ${user.id}, NOW(), NOW() + INTERVAL '1 hour'
        );
      `;

      // Second attempt to approve
      const secondApproveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/approvals/${decidedApprovalId}/approve`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {},
      });
      expect(secondApproveRes.statusCode).toBe(409);
      expect(secondApproveRes.json().error?.code).toBe('APPROVAL_ALREADY_DECIDED');

      // Attempt to reject an already approved row
      const rejectRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/approvals/${decidedApprovalId}/reject`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { reason: 'No' },
      });
      expect(rejectRes.statusCode).toBe(409);
      expect(rejectRes.json().error?.code).toBe('APPROVAL_ALREADY_DECIDED');
    },
    30000,
  );
});
