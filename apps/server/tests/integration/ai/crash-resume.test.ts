// apps/server/tests/integration/ai/crash-resume.test.ts
//
// Chunk 6: Checkpoint recovery after simulated process death,
//          duplicate job deduplication, and dead worker recovery via reaper.

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
import { runReaperSweep } from '../../../src/modules/ai/workers/reaper.worker.js';
import { AgentRunRepository } from '../../../src/modules/ai/runs/agent-run.repository.js';
import { startQueue, stopQueue } from '../../../src/lib/queue/index.js';
import { registerAgentRunWorkers } from '../../../src/modules/ai/workers/agent-run.worker.js';
import { teardownCheckpointer, getCheckpointer } from '../../../src/modules/ai/graph/checkpointer.js';

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

describe('Crash-Resume & Duplicate Job Delivery', () => {
  it(
    '1. checkpoint recovery after process restart: graph state restored from PostgreSQL checkpointer',
    async () => {
      const { orgId, token } = await createOrgWithAiPermissions(app);
      const sql = getTestSql();

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
          input: { amount: 250, action: 'reboot_recovery' },
        },
      });
      expect(postRes.statusCode).toBe(202);
      const runId = postRes.json().data.runId;

      // Wait until graph pauses at interrupt (AWAITING_APPROVAL)
      await waitForRunStatus(runId, 'AWAITING_APPROVAL', 30000);

      // Verify checkpoint exists in PostgreSQL langgraph schema
      const checkpointRows = await sql`
        SELECT thread_id, checkpoint_id
        FROM langgraph.checkpoints
        WHERE thread_id = ${runId}
      `;
      expect(checkpointRows.length).toBeGreaterThan(0);

      // Simulate process crash: tear down checkpointer connection pool completely
      await teardownCheckpointer();

      // Verify new checkpointer instance connects cleanly to existing PostgreSQL database
      const freshCheckpointer = await getCheckpointer();
      expect(freshCheckpointer).toBeDefined();

      // Fetch pending approval ID
      const approvalRows = await sql`
        SELECT id FROM app.agent_approvals WHERE run_id = ${runId} AND status = 'PENDING'
      `;
      const approvalId = approvalRows[0].id;

      // Approve via HTTP — triggers resume from checkpoint in PostgreSQL
      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/approvals/${approvalId}/approve`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { note: 'Approved after simulated reboot' },
      });
      expect(approveRes.statusCode).toBe(200);

      // Verify resumed run restores checkpoint state and completes with SUCCEEDED
      const succeededRun = await waitForRunStatus(runId, 'SUCCEEDED', 30000);
      expect(succeededRun.status).toBe('SUCCEEDED');
      expect(succeededRun.output?.summary).toContain('Approved binding action executed successfully');
    },
    60000,
  );

  it(
    '2. duplicate job deduplication: second worker skips when run is already RUNNING',
    async () => {
      const { orgId, user } = await createOrgWithAiPermissions(app);
      const sql = getTestSql();
      const runId = crypto.randomUUID();

      // Insert run with RUNNING status (simulating first worker claimed it)
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by, started_at)
        VALUES (${runId}, ${orgId}, 'echo', 'USER', 'RUNNING', ${user.id}, NOW());
      `;

      // Second worker calls setRunningIfQueued — should return false (H4 deduplication defense)
      const repo = new AgentRunRepository();
      const claimed = await repo.setRunningIfQueued(runId);
      expect(claimed).toBe(false);

      // Status unchanged
      const rows = await sql`SELECT status FROM app.agent_runs WHERE id = ${runId}`;
      expect(rows[0].status).toBe('RUNNING');
    },
    15000,
  );

  it(
    '3. duplicate job deduplication: second worker skips when run is already SUCCEEDED',
    async () => {
      const { orgId, user } = await createOrgWithAiPermissions(app);
      const sql = getTestSql();
      const runId = crypto.randomUUID();

      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by, started_at, finished_at)
        VALUES (${runId}, ${orgId}, 'echo', 'USER', 'SUCCEEDED', ${user.id}, NOW(), NOW());
      `;

      const repo = new AgentRunRepository();
      const claimed = await repo.setRunningIfQueued(runId);
      expect(claimed).toBe(false);

      const rows = await sql`SELECT status FROM app.agent_runs WHERE id = ${runId}`;
      expect(rows[0].status).toBe('SUCCEEDED');
    },
    15000,
  );

  it(
    '4. dead worker recovery: reaper marks RUNNING runs with updatedAt > 10 minutes ago as FAILED',
    async () => {
      const { orgId, user } = await createOrgWithAiPermissions(app);
      const sql = getTestSql();
      const runId = crypto.randomUUID();

      // Insert a stale RUNNING run — updated 15 minutes ago (simulates dead worker)
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by, started_at, updated_at)
        VALUES (
          ${runId}, ${orgId}, 'echo', 'USER', 'RUNNING', ${user.id},
          NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes'
        );
      `;

      // Run reaper sweep
      const sweepResult = await runReaperSweep();
      expect(sweepResult.hungRunsFailed).toBeGreaterThanOrEqual(1);

      // Verify the run was marked FAILED with the correct error
      const rows = await sql`SELECT status, error FROM app.agent_runs WHERE id = ${runId}`;
      expect(rows[0].status).toBe('FAILED');
      expect(rows[0].error).toContain('worker died or was terminated');
    },
    20000,
  );

  it(
    '5. stale QUEUED runs that were never picked up are marked FAILED by reaper',
    async () => {
      const { orgId, user } = await createOrgWithAiPermissions(app);
      const sql = getTestSql();
      const runId = crypto.randomUUID();

      // Insert a stale QUEUED run — created 3 hours ago
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by, created_at, updated_at)
        VALUES (
          ${runId}, ${orgId}, 'echo', 'USER', 'QUEUED', ${user.id},
          NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'
        );
      `;

      const sweepResult = await runReaperSweep();
      expect(sweepResult.staleQueuedFailed).toBeGreaterThanOrEqual(1);

      const rows = await sql`SELECT status, error FROM app.agent_runs WHERE id = ${runId}`;
      expect(rows[0].status).toBe('FAILED');
      expect(rows[0].error).toContain('job was never claimed by a worker');
    },
    20000,
  );
});
