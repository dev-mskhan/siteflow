// apps/server/tests/integration/ai/echo-loop-and-slow.test.ts
//
// Chunk 5: Runaway loop termination, usage-flush on failure, timeout via AbortSignal,
//          cooperative cancellation, and concurrency status-protection.

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

describe('Echo-Loop & Echo-Slow: Limits, Timeout, and Cancellation', () => {
  it(
    '1. echo-loop terminates with MaxStepsExceededError and status FAILED after exceeding maxSteps',
    async () => {
      const { orgId, token } = await createOrgWithAiPermissions(app);

      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          agent: 'echo-loop',
          input: {},
        },
      });
      expect(postRes.statusCode).toBe(202);
      const runId = postRes.json().data.runId;

      // echo-loop has limitOverrides: { maxSteps: 3 }
      // Should terminate cleanly and transition to FAILED
      const failedRun = await waitForRunStatus(runId, 'FAILED', 30000);
      expect(failedRun.status).toBe('FAILED');
      expect(failedRun.error).toMatch(/max steps|exceeded|recursion/i);
    },
    45000,
  );

  it(
    '2. partial usage (tokens/cost) is flushed to agent_usage_daily even when run fails',
    async () => {
      const { orgId, token } = await createOrgWithAiPermissions(app);
      const sql = getTestSql();

      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          agent: 'echo-loop',
          input: {},
        },
      });
      expect(postRes.statusCode).toBe(202);
      const runId = postRes.json().data.runId;

      await waitForRunStatus(runId, 'FAILED', 30000);

      // Verify the run status is FAILED
      const runRows = await sql`
        SELECT * FROM app.agent_runs WHERE id = ${runId}
      `;
      expect(runRows[0].status).toBe('FAILED');

      // Verify partial usage was flushed to agent_usage_daily in finally block
      const usageRows = await sql`
        SELECT * FROM app.agent_usage_daily
        WHERE organization_id = ${orgId} AND agent = 'echo-loop'
      `;
      expect(usageRows.length).toBeGreaterThan(0);
      expect(Number(usageRows[0].tokens_in)).toBeGreaterThan(0);
      expect(Number(usageRows[0].tokens_out)).toBeGreaterThan(0);
    },
    45000,
  );

  it(
    '3. echo-slow times out via AbortSignal and transitions to FAILED with RunTimeoutError',
    async () => {
      const { orgId, token } = await createOrgWithAiPermissions(app);

      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          agent: 'echo-slow',
          input: {},
        },
      });
      expect(postRes.statusCode).toBe(202);
      const runId = postRes.json().data.runId;

      // echo-slow has limitOverrides: { timeoutMs: 3000 }
      // Tool sleeps for timeoutMs + 2000; AbortSignal/timeout check fires and fails the run
      const failedRun = await waitForRunStatus(runId, 'FAILED', 30000);
      expect(failedRun.status).toBe('FAILED');
      expect(failedRun.error).toMatch(/timed out|timeout|abort/i);
    },
    45000,
  );

  it(
    '4. cooperative cancellation: cancelling an active RUNNING run transitions status to CANCELLED',
    async () => {
      const { orgId, token } = await createOrgWithAiPermissions(app);
      const sql = getTestSql();

      // Start an echo-slow run
      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          agent: 'echo-slow',
          input: {},
        },
      });
      expect(postRes.statusCode).toBe(202);
      const runId = postRes.json().data.runId;

      // Wait until it reaches RUNNING
      await waitForRunStatus(runId, 'RUNNING', 15000);

      // Cancel via DELETE endpoint
      const cancelRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/ai/runs/${runId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      expect(cancelRes.statusCode).toBe(200);

      // Wait for run to settle into CANCELLED
      const cancelledRun = await waitForRunStatus(runId, 'CANCELLED', 15000);
      expect(cancelledRun.status).toBe('CANCELLED');

      // Verify it stays CANCELLED
      const rows = await sql`SELECT status FROM app.agent_runs WHERE id = ${runId}`;
      expect(rows[0].status).toBe('CANCELLED');
    },
    30000,
  );

  it(
    '5. finishing worker never overwrites CANCELLED status with SUCCEEDED (concurrency protection)',
    async () => {
      const { orgId, user } = await createOrgWithAiPermissions(app);
      const sql = getTestSql();

      // Simulate a run that was cancelled mid-execution
      const runId = crypto.randomUUID();
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by)
        VALUES (${runId}, ${orgId}, 'echo-slow', 'USER', 'CANCELLED', ${user.id});
      `;

      // Simulate finishing worker calling setSucceeded
      const { AgentRunRepository } = await import('../../../src/modules/ai/runs/agent-run.repository.js');
      const repo = new AgentRunRepository();
      await repo.setSucceeded(runId, { completed: true }, 10, 5, '0.001');

      // Verify the DB status was NOT overwritten and remains CANCELLED
      const rows = await sql`
        SELECT status FROM app.agent_runs WHERE id = ${runId}
      `;
      expect(rows[0].status).toBe('CANCELLED');

      // Also verify setRunningIfQueued returns false for CANCELLED status
      const claimed = await repo.setRunningIfQueued(runId);
      expect(claimed).toBe(false);
    },
    15000,
  );
});
