// apps/server/tests/integration/ai/echo-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type PgBoss from 'pg-boss';
import { createTestApp } from '../../helpers/test-app.js';
import {
  createOrgWithAiPermissions,
  waitForRunStatus,
  getTestSql,
  closeTestSql,
} from '../../helpers/ai/ai-fixtures.js';
import { startQueue, stopQueue } from '../../../src/lib/queue/index.js';
import { registerAgentRunWorkers } from '../../../src/modules/ai/workers/agent-run.worker.js';
import { AI_QUEUES } from '../../../src/modules/ai/ai.jobs.js';

describe('Echo Agent API Channel End-to-End Test Suite', () => {
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
      // ignore cleanup errors
    }
    if (app) {
      await app.close();
    }
    await closeTestSql();
  });

  it(
    'executes echo agent end-to-end from POST /ai/runs through PgBoss worker to SUCCEEDED',
    async () => {
      // 1. Create org with user holding ai.runs.create, ai.runs.read, etc.
      const { orgId, token } = await createOrgWithAiPermissions(app);

      const requestPayload = {
        agent: 'echo',
        input: {
          greeting: 'Hello SiteFlow',
          number: 42,
        },
      };

      // 2. Submit HTTP POST request to start run
      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: requestPayload,
      });

      expect([201, 202]).toContain(postRes.statusCode);
      const postBody = postRes.json();
      const runId = postBody.data?.runId ?? postBody.runId;
      expect(runId).toBeDefined();

      // 3. Immediately inspect database row in app.agent_runs
      const initialRows = await sql`
        SELECT status, channel, input_snapshot
        FROM app.agent_runs
        WHERE id = ${runId}
      `;
      expect(initialRows.length).toBe(1);
      expect(['QUEUED', 'RUNNING', 'SUCCEEDED']).toContain(initialRows[0].status);
      expect(initialRows[0].channel).toBe('api');

      // 4. Wait for background PgBoss worker to complete the run
      const finishedRun = await waitForRunStatus(runId, 'SUCCEEDED', 30000);

      // 5. Assertions on the finished run
      expect(finishedRun).toBeDefined();
      expect(finishedRun.status).toBe('SUCCEEDED');

      // Answer must strictly echo the input payload
      const output = typeof finishedRun.output === 'string'
        ? JSON.parse(finishedRun.output)
        : finishedRun.output;
      expect(output.answer).toEqual({
        greeting: 'Hello SiteFlow',
        number: 42,
      });

      // Timestamps must be recorded
      expect(finishedRun.started_at).toBeDefined();
      expect(finishedRun.finished_at).toBeDefined();
      const startedAtMs = new Date(finishedRun.started_at).getTime();
      const finishedAtMs = new Date(finishedRun.finished_at).getTime();
      expect(finishedAtMs).toBeGreaterThanOrEqual(startedAtMs);

      // Trace ID must be populated
      expect(finishedRun.trace_id).toBeDefined();
      expect(finishedRun.trace_id.length).toBeGreaterThan(0);

      // 6. Assert daily usage aggregate row exists in app.agent_usage_daily
      const today = new Date().toISOString().slice(0, 10);
      const usageRows = await sql`
        SELECT agent, runs_count
        FROM app.agent_usage_daily
        WHERE organization_id = ${orgId} AND day = ${today} AND agent = 'echo'
      `;
      expect(usageRows.length).toBe(1);
      expect(usageRows[0].agent).toBe('echo');
      expect(usageRows[0].runs_count).toBeGreaterThanOrEqual(1);

      // 7. Verify no orphaned active jobs in pgboss.job
      const orphanJobs = await sql`
        SELECT id, name, state
        FROM pgboss.job
        WHERE name = ${AI_QUEUES.AGENT_RUN}
          AND data->>'runId' = ${runId}
          AND state IN ('active', 'retry')
      `;
      expect(orphanJobs.length).toBe(0);
    },
    60000,
  );
});
