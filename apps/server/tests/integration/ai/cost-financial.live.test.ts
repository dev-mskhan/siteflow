// apps/server/tests/integration/ai/cost-financial.live.test.ts
//
// LIVE TESTS for cost-financial agent with REAL Gemini LLM via web2api
//
// Run with: AI_LIVE=1 pnpm test tests/integration/ai/cost-financial.live.test.ts
//
// Requirements:
// - web2api running at http://127.0.0.1:8081
// - Langfuse running at http://localhost:3020
// - All docker services running (postgres, redis, minio)
//
// Unlike deterministic tests, these use REAL Gemini and results may vary.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type PgBoss from 'pg-boss';

import { createTestApp } from '../../helpers/test-app.js';
import {
  waitForRunStatus,
  getTestSql,
  closeTestSql,
} from '../../helpers/ai/ai-fixtures.js';
import {
  seedCostFinancialFixtures,
  type CostFinancialFixtures,
} from '../../helpers/ai/cost-financial-fixtures.js';
import { startQueue, stopQueue } from '../../../src/lib/queue/index.js';
import { registerAgentRunWorkers } from '../../../src/modules/ai/workers/agent-run.worker.js';

// Register tool definitions
import '../../../src/modules/ai/index.js';

// Helper to check if live tests are enabled
const LIVE_ENABLED = process.env.AI_LIVE === '1';
const skipIfNotLive = LIVE_ENABLED ? it : it.skip;

describe.skipIf(!LIVE_ENABLED)('Cost-Financial Agent - LIVE TESTS (Real Gemini)', () => {
  let app: FastifyInstance;
  let boss: PgBoss;
  let seed: CostFinancialFixtures;
  const sql = getTestSql();

  beforeAll(async () => {
    app = await createTestApp();
    boss = await startQueue();
    await registerAgentRunWorkers(boss);
    seed = await seedCostFinancialFixtures(app);

    console.log('\n========================================');
    console.log('🚀 LIVE TEST SETUP COMPLETE');
    console.log('========================================');
    console.log(`Organization: ${seed.orgA.orgId}`);
    console.log(`Project: ${seed.orgA.projectId}`);
    console.log(`Langfuse: http://localhost:3020`);
    console.log('🔴 Using REAL Gemini LLM (not fake model)');
    console.log('========================================\n');
  }, 120_000);

  afterAll(async () => {
    try {
      await stopQueue();
    } catch {
      /* ignore */
    }
    if (app) await app.close();
    await closeTestSql();
  });

  // Helper to start a run and wait for completion
  async function executeRun(question: string, runNumber: number = 1) {
    const startTime = Date.now();
    const { orgId, token, projectId } = seed.orgA;

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/ai/runs`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        agent: 'cost-financial',
        input: { question, projectId },
      },
    });

    expect([201, 202]).toContain(createRes.statusCode);
    const runId: string = createRes.json().data?.runId ?? createRes.json().runId;

    console.log(`[Run ${runNumber}] Started: ${runId}`);

    // Wait for completion (real LLM takes 5-15 seconds)
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 90_000);

    const duration = Date.now() - startTime;

    console.log(`[Run ${runNumber}] ✅ ${run.status} (${duration}ms)`);
    console.log(`[Run ${runNumber}] 🔗 Trace: http://localhost:3020/traces/${run.trace_id}`);
    console.log(`[Run ${runNumber}] 📊 Tokens: ${run.tokens_in}/${run.tokens_out}`);

    return { run, duration, runId };
  }

  skipIfNotLive(
    'LIVE-1: Simple budget inquiry',
    async () => {
      const question = `What is the current budget for this project?`;

      const { run } = await executeRun(question, 1);

      expect(run.status).toBe('SUCCEEDED');
      expect(run.trace_id).toBeTruthy();

      const output = typeof run.output === 'string' ? JSON.parse(run.output) : run.output;

      console.log('\n📝 OUTPUT:');
      console.log('  Narrative:', output.answer.narrative.substring(0, 150) + '...');
      console.log('  Figures:', output.answer.figures.length);
      console.log('  Confidence:', output.answer.confidence);
      console.log('  Citations:', output.citations.length, '\n');

      expect(output.answer.narrative).toBeTruthy();
      expect(output.answer.confidence).toMatch(/HIGH|MEDIUM|LOW|INSUFFICIENT_DATA/);
      expect(output.citations.length).toBeGreaterThan(0);
    },
    120_000,
  );

  skipIfNotLive(
    'LIVE-2: Budget vs actuals comparison',
    async () => {
      const question = `Is this project over budget or under budget?`;

      const { run } = await executeRun(question, 2);

      expect(run.status).toBe('SUCCEEDED');

      const output = typeof run.output === 'string' ? JSON.parse(run.output) : run.output;

      console.log('\n📝 OUTPUT:');
      console.log('  Narrative:', output.answer.narrative.substring(0, 200) + '...');
      console.log('  Confidence:', output.answer.confidence, '\n');

      expect(output.answer.confidence).toMatch(/HIGH|MEDIUM/);
    },
    120_000,
  );

  skipIfNotLive(
    'LIVE-3: Multi-tool question',
    async () => {
      const question = `What is the financial health of this project?`;

      const { run } = await executeRun(question, 3);

      expect(run.status).toBe('SUCCEEDED');

      const output = typeof run.output === 'string' ? JSON.parse(run.output) : run.output;

      console.log('\n📝 OUTPUT:');
      console.log('  Tools used:', output.citations.map((c: any) => c.toolName).join(', '));
      console.log('  Confidence:', output.answer.confidence, '\n');

      expect(output.citations.length).toBeGreaterThanOrEqual(1);
    },
    120_000,
  );

  skipIfNotLive(
    'LIVE-4: Abstention test',
    async () => {
      const question = `What is the weather forecast for the construction site?`;

      const { run } = await executeRun(question, 4);

      expect(run.status).toBe('SUCCEEDED');

      const output = typeof run.output === 'string' ? JSON.parse(run.output) : run.output;

      console.log('\n📝 OUTPUT:');
      console.log('  Narrative:', output.answer.narrative.substring(0, 150) + '...');
      console.log('  Confidence:', output.answer.confidence);
      console.log('  Missing data:', output.answer.missingData, '\n');

      const narrative = output.answer.narrative.toLowerCase();
      const abstained =
        narrative.includes('cannot') ||
        narrative.includes('unable') ||
        output.answer.confidence === 'INSUFFICIENT_DATA';

      expect(abstained).toBe(true);
    },
    120_000,
  );

  skipIfNotLive(
    'LIVE-5: Variability test (3 runs)',
    async () => {
      const question = `Summarize the financial status of this project.`;

      console.log('\n🔄 VARIABILITY TEST: Running same question 3 times...\n');

      const runs = [];

      for (let i = 1; i <= 3; i++) {
        const { run, duration } = await executeRun(question, i);
        runs.push({ run, duration, iteration: i });

        // Wait between runs to avoid rate limits
        if (i < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      runs.forEach((r) => expect(r.run.status).toBe('SUCCEEDED'));

      console.log('\n📊 VARIABILITY ANALYSIS:');
      runs.forEach((r, idx) => {
        const output = typeof r.run.output === 'string' ? JSON.parse(r.run.output) : r.run.output;
        console.log(`\nRun ${idx + 1}:`);
        console.log(`  Duration: ${r.duration}ms`);
        console.log(`  Tokens: ${r.run.tokens_in}/${r.run.tokens_out}`);
        console.log(`  Confidence: ${output.answer.confidence}`);
        console.log(`  Tools: ${output.citations.map((c: any) => c.toolName).join(', ')}`);
      });

      const durations = runs.map((r) => r.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log('\n📈 METRICS:');
      console.log(`  Average: ${Math.round(avgDuration)}ms`);
      console.log(`  Range: ${minDuration}ms - ${maxDuration}ms`);
      console.log(`  Variability: ${Math.round(((maxDuration - minDuration) / avgDuration) * 100)}%\n`);
    },
    300_000, // 5 minutes for 3 runs
  );
});
