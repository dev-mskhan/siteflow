// Live smoke test against the already-running API database and PgBoss worker.
//
// Run from apps/server with:
//   $env:AI_LIVE='1'
//   $env:AI_LIVE_PROJECT_ID='<existing test project UUID>'
//   pnpm exec vitest run tests/integration/ai/cost-financial.live.test.ts --testTimeout=270000
//
// The selected project must have "test" in its name and populated financial
// data. This test enqueues one real model request and does not start a worker.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { agentToolCalls, projects } from '@siteflow/database/schema';
import { serverEnv } from '../../../src/config/env.js';
import { getDb } from '../../../src/lib/db/index.js';
import { stopQueue } from '../../../src/lib/queue/index.js';
import { AgentRunRepository } from '../../../src/modules/ai/runs/agent-run.repository.js';
import { AgentRunService } from '../../../src/modules/ai/runs/agent-run.service.js';
import { rbacService } from '../../../src/modules/rbac/rbac.service.js';
import { financialSummaryService } from '../../../src/modules/project/financial-summary/financial-summary.service.js';
import { costFinancialOutputSchema } from '../../../src/modules/ai/agents/cost-financial/output.schema.js';

const LIVE_ENABLED = process.env.AI_LIVE === '1';
const PROJECT_ID = process.env.AI_LIVE_PROJECT_ID;
const MAX_WAIT_MS = 240_000;
const POLL_INTERVAL_MS = 1_500;
const TERMINAL_STATUSES = new Set([
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'AWAITING_APPROVAL',
]);

if (LIVE_ENABLED && !PROJECT_ID) {
  throw new Error('AI_LIVE_PROJECT_ID must identify an existing test project');
}

describe.skipIf(!LIVE_ENABLED)('cost-financial live worker smoke test', () => {
  const runs = new AgentRunRepository();
  const runService = new AgentRunService();
  let expectedFigures: Array<{
    label: string;
    value: string;
    currency: string;
    sourceKey: string;
  }> = [];
  let project: {
    id: string;
    organizationId: string;
    createdBy: string;
    name: string;
  };

  beforeAll(async () => {
    const databaseHost = new URL(serverEnv.DATABASE_URL).hostname;
    if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
      throw new Error(
        `Refusing live AI test against non-local database host "${databaseHost}"`,
      );
    }
    if (serverEnv.AI_PROVIDER === 'fake') {
      throw new Error('AI_PROVIDER=fake; refusing to run a live model test');
    }
    if (!serverEnv.LANGFUSE_PUBLIC_KEY || !serverEnv.LANGFUSE_SECRET_KEY) {
      throw new Error('Langfuse is not configured; refusing a trace-evaluation run');
    }

    const rows = await getDb()
      .select({
        id: projects.id,
        organizationId: projects.organizationId,
        createdBy: projects.createdBy,
        name: projects.name,
      })
      .from(projects)
      .where(eq(projects.id, PROJECT_ID!))
      .limit(1);
    const candidate = rows[0];
    if (!candidate || !candidate.createdBy || !candidate.name.toLowerCase().includes('test')) {
      throw new Error('AI_LIVE_PROJECT_ID must belong to an existing test project with an owner');
    }
    project = { ...candidate, createdBy: candidate.createdBy };

    const orgContext = await rbacService.getOrganizationContext(
      project.organizationId,
      project.createdBy,
    );
    if (!rbacService.hasPermission(orgContext, 'project:read')) {
      throw new Error('The test project owner does not have project:read permission');
    }

    const summary = await financialSummaryService.getCostSummary(
      project.organizationId,
      project.id,
    );
    const hasFinancialData = summary.currencyBreakdown.some((row) =>
      [row.originalBudget, row.approvedBudgetChanges, row.revisedBudget, row.committed, row.postedActual]
        .some((value) => Number(value) > 0),
    );
    if (!hasFinancialData) {
      throw new Error('The selected test project has no non-zero budget, commitment, or actual data');
    }
    expectedFigures = summary.currencyBreakdown.map((row) => ({
      label: 'Committed Costs',
      value: row.committed,
      currency: row.currencyCode,
      sourceKey: 'committed',
    }));
  }, 30_000);

  afterAll(async () => {
    await stopQueue();
    await getDb().$client.end();
  });

  it(
    'enqueues one cost inquiry and evaluates the result from the running worker',
    async () => {
      const question =
        'Retrieve the cost summary for the selected project. Report the exact committed costs from ' +
        'that source only; do not calculate or combine totals. Cite the source data.';
      const startedAt = Date.now();
      const { runId } = await runService.startRun({
        organizationId: project.organizationId,
        agent: 'cost-financial',
        input: { question, projectId: project.id },
        createdBy: project.createdBy,
        channel: 'api',
        trigger: 'USER',
      });

      console.log(`[cost-financial live] queued run ${runId} for ${project.name}`);

      const deadline = startedAt + MAX_WAIT_MS;
      let nextProgressLog = startedAt + 15_000;
      let run = await runs.findByIdInternal(runId);

      while (
        run &&
        !TERMINAL_STATUSES.has(run.status) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        run = await runs.findByIdInternal(runId);
        if (Date.now() >= nextProgressLog) {
          console.log(
            `[cost-financial live] ${runId}: ${run?.status ?? 'missing'} after ${Math.round((Date.now() - startedAt) / 1000)}s`,
          );
          nextProgressLog += 15_000;
        }
      }

      if (!run || !TERMINAL_STATUSES.has(run.status)) {
        await runService.cancelRun(runId, project.organizationId, project.createdBy);
        throw new Error(
          `Timed out after ${MAX_WAIT_MS}ms; run ${runId} remained ${run?.status ?? 'missing'}. ` +
            'If still QUEUED, the running worker is not consuming this database/queue.',
        );
      }

      const toolRows = await getDb()
        .select({
          toolName: agentToolCalls.toolName,
          status: agentToolCalls.status,
          durationMs: agentToolCalls.durationMs,
        })
        .from(agentToolCalls)
        .where(eq(agentToolCalls.runId, runId));

      console.log(
        JSON.stringify({
          runId,
          status: run.status,
          elapsedMs: Date.now() - startedAt,
          traceId: run.traceId,
          tokens: { input: run.tokensIn, output: run.tokensOut },
          costUsd: run.costUsd,
          error: run.error,
          tools: toolRows,
        }),
      );

      expect(run.status, run.error ?? 'worker did not complete successfully').toBe('SUCCEEDED');
      expect(run.traceId, 'Langfuse trace ID was not recorded').toBeTruthy();
      expect((run.tokensIn ?? 0) + (run.tokensOut ?? 0)).toBeGreaterThan(0);

      const output =
        typeof run.output === 'string' ? JSON.parse(run.output) : run.output;
      const parsed = costFinancialOutputSchema.safeParse(output);
      expect(parsed.success, 'agent output did not match the output contract').toBe(true);
      if (!parsed.success) return;

      console.log(
        JSON.stringify({
          confidence: parsed.data.answer.confidence,
          figures: parsed.data.answer.figures.length,
          citations: parsed.data.citations.map((citation) => citation.toolName),
          summary: parsed.data.summary,
        }),
      );
      expect(parsed.data.answer.confidence).not.toBe('INSUFFICIENT_DATA');
      expect(
        parsed.data.citations.some(
          (citation) =>
            citation.toolName === 'get_cost_summary' ||
            citation.toolName === 'get_financial_summary',
        ),
        'answer did not cite a financial-summary tool',
      ).toBe(true);
      expect(
        toolRows.some(
          (toolCall) =>
            ['get_cost_summary', 'get_financial_summary'].includes(toolCall.toolName) &&
            toolCall.status === 'SUCCESS',
        ),
        'worker did not successfully execute a financial-summary tool',
      ).toBe(true);

      const costCitation = parsed.data.citations.find(
        (citation) => citation.toolName === 'get_cost_summary',
      );
      expect(costCitation, 'cost summary citation was not returned').toBeDefined();
      for (const expected of expectedFigures) {
        const figure = parsed.data.answer.figures.find(
          (item) =>
            item.currency === expected.currency &&
            item.label.toLowerCase().includes('committed'),
        );
        expect(String(figure?.value), `${expected.label} did not match the database source`)
          .toBe(expected.value);
        expect(costCitation?.snippet).toContain(`"${expected.sourceKey}":"${expected.value}"`);
      }
    },
    260_000,
  );
});
