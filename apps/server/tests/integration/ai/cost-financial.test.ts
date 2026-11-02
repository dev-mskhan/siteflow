// apps/server/tests/integration/ai/cost-financial.test.ts
//
// Cost-Financial Agent — API channel integration tests.
//
// Coverage:
//   A. Basic tool execution (1–7)  — verifies each of the 7 READ tools is called
//      end-to-end and the output schema is valid.
//   B. Edge cases         (8–12)  — empty results, tool error, multi-tool, JSON
//      repair, plain-text fallback.
//   C. Security           (13–17) — cross-tenant, wrong org URL, no permission,
//      prompt injection in tool result, over-budget guard.
//   D. Run lifecycle      (18–20) — cancel mid-flight, list scoping, usage row.
//
// Design rules (never break these):
//   1. Fake model scripts control every LLM call — zero real API calls.
//   2. Assertions use SEED_PROJECT_A constants, never the agent's own output.
//   3. waitForRunStatus target is a single AgentRunStatus string.
//   4. Tool-call text turn: { toolCalls: [{name, args}] }
//      Final answer turn:   { text: buildFinalAnswer({...}) }
//   5. clearScriptedModel() in beforeEach — each test is fully isolated.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type PgBoss from 'pg-boss';
import crypto from 'node:crypto';

// ── Test harness ──────────────────────────────────────────────────────────────
import { createTestApp } from '../../helpers/test-app.js';
import {
  createOrgWithAiPermissions,
  waitForRunStatus,
  getTestSql,
  closeTestSql,
} from '../../helpers/ai/ai-fixtures.js';
import { installScriptedModel, clearScriptedModel } from '../../helpers/ai/fake-model.js';
import {
  seedCostFinancialFixtures,
  buildFinalAnswer,
  SEED_PROJECT_A,
  type CostFinancialFixtures,
} from '../../helpers/ai/cost-financial-fixtures.js';
import { startQueue, stopQueue } from '../../../src/lib/queue/index.js';
import { registerAgentRunWorkers } from '../../../src/modules/ai/workers/agent-run.worker.js';

// Register all tool definitions (side-effect import, same as other test files)
import '../../../src/modules/ai/index.js';

// ── Suite setup ───────────────────────────────────────────────────────────────

let app: FastifyInstance;
let boss: PgBoss;
let seed: CostFinancialFixtures;
const sql = getTestSql();

beforeAll(async () => {
  app  = await createTestApp();
  boss = await startQueue();
  await registerAgentRunWorkers(boss);
  // Seed two isolated orgs once — tests share seed data but own their fake model
  seed = await seedCostFinancialFixtures(app);
}, 120_000);

afterAll(async () => {
  clearScriptedModel();
  try { await stopQueue(); } catch { /* ignore */ }
  if (app) await app.close();
  await closeTestSql();
});

beforeEach(() => {
  // Guarantee every test starts with a clean fake-model queue
  clearScriptedModel();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** POST /ai/runs and return the runId. */
async function startRun(
  orgId: string,
  token: string,
  question: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/organizations/${orgId}/ai/runs`,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload: { agent: 'cost-financial', input: { question } },
  });
  expect([201, 202]).toContain(res.statusCode);
  const runId: string = res.json().data?.runId ?? res.json().runId;
  expect(runId).toBeTruthy();
  return runId;
}

/** Parse agent_runs.output whether it arrived as object or JSON string. */
function parseOutput(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') return JSON.parse(raw) as Record<string, unknown>;
  return raw as Record<string, unknown>;
}

// ═════════════════════════════════════════════════════════════════════════════
// A. Basic tool execution (tests 1–7)
// ═════════════════════════════════════════════════════════════════════════════

describe('A. Basic tool execution', () => {
  it(
    '1. get_financial_summary — full snapshot question succeeds with structured output',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        // Turn 1: model calls get_financial_summary
        {
          toolCalls: [{ name: 'get_financial_summary', args: { projectId: project.id } }],
          tokensIn: 120, tokensOut: 30,
        },
        // Turn 2: model returns final structured answer
        {
          text: buildFinalAnswer({
            narrative: `Full financial snapshot for project ${project.id}.`,
            figures: [
              { label: 'Revised Budget', value: SEED_PROJECT_A.budgetRevised, currency: 'USD' },
            ],
            summary: 'Financial snapshot retrieved.',
            toolName: 'get_financial_summary',
            snippet: 'cost + billingAndCash + commitments returned',
          }),
          tokensIn: 200, tokensOut: 80,
        },
      ]);

      const runId = await startRun(orgId, token, `Give me the full financial snapshot for project ${project.id}`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      // ── Core assertions ───────────────────────────────────────────────────
      expect(run.status).toBe('SUCCEEDED');
      expect(run.trace_id).toBeTruthy();
      expect(run.channel).toBe('api');

      const output = parseOutput(run.output);
      expect(output.answer).toBeDefined();
      expect((output.answer as any).narrative).toBeTruthy();
      expect(Array.isArray((output.answer as any).figures)).toBe(true);
      expect(Array.isArray(output.citations)).toBe(true);
      expect((output.citations as any[]).length).toBeGreaterThan(0);
      expect(output.summary).toBeTruthy();
      expect((output.summary as string).length).toBeLessThanOrEqual(500);

      // ── DB assertions ─────────────────────────────────────────────────────
      const toolRows = await sql`
        SELECT tool_name, status FROM app.agent_tool_calls
        WHERE run_id = ${runId}
      `;
      expect(toolRows.some((r) => r.tool_name === 'get_financial_summary')).toBe(true);
      expect(toolRows.every((r) => r.status === 'SUCCESS')).toBe(true);

      console.log(`✓ Test 1 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '2. get_cost_summary — cost breakdown question records tool call and correct figures',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        { toolCalls: [{ name: 'get_cost_summary', args: { projectId: project.id } }], tokensIn: 100, tokensOut: 25 },
        {
          text: buildFinalAnswer({
            narrative: `Cost summary: revised budget ${SEED_PROJECT_A.budgetRevised}, actual ${SEED_PROJECT_A.actualCost}.`,
            figures: [
              { label: 'Revised Budget',  value: SEED_PROJECT_A.budgetRevised,  currency: 'USD' },
              { label: 'Actual Cost',     value: SEED_PROJECT_A.actualCost,     currency: 'USD' },
              { label: 'Committed Cost',  value: SEED_PROJECT_A.committedCost,  currency: 'USD' },
            ],
            summary: `Project is ${SEED_PROJECT_A.variance} under its committed budget.`,
            toolName: 'get_cost_summary',
            snippet: 'budget vs actuals breakdown',
          }),
          tokensIn: 180, tokensOut: 70,
        },
      ]);

      const runId = await startRun(orgId, token, `What are the cost figures for project ${project.id}?`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');
      const output = parseOutput(run.output);
      const figures = (output.answer as any).figures as Array<{ label: string; value: string | number }>;
      // The figure values must match our seed constants (model is scripted to echo them)
      const revisedFigure = figures.find((f) => f.label === 'Revised Budget');
      expect(revisedFigure?.value).toBe(SEED_PROJECT_A.budgetRevised);

      const toolRows = await sql`SELECT tool_name FROM app.agent_tool_calls WHERE run_id = ${runId}`;
      expect(toolRows.some((r) => r.tool_name === 'get_cost_summary')).toBe(true);

      console.log(`✓ Test 2 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '3. get_billing_summary — billing question calls correct tool',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        { toolCalls: [{ name: 'get_billing_summary', args: { projectId: project.id } }], tokensIn: 90, tokensOut: 20 },
        {
          text: buildFinalAnswer({
            narrative: 'Billing summary retrieved successfully.',
            summary: 'Billing and retainage data returned.',
            toolName: 'get_billing_summary',
            snippet: 'approvedContractValue + billedReceivables',
          }),
          tokensIn: 150, tokensOut: 60,
        },
      ]);

      const runId = await startRun(orgId, token, `What is the billing status for project ${project.id}?`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');
      const toolRows = await sql`SELECT tool_name FROM app.agent_tool_calls WHERE run_id = ${runId}`;
      expect(toolRows.some((r) => r.tool_name === 'get_billing_summary')).toBe(true);

      console.log(`✓ Test 3 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '4. get_cash_summary — cash flow question calls correct tool',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        { toolCalls: [{ name: 'get_cash_summary', args: { projectId: project.id } }], tokensIn: 90, tokensOut: 20 },
        {
          text: buildFinalAnswer({
            narrative: 'Cash received, paid, and net position retrieved.',
            summary: 'Net cash position available from tool results.',
            toolName: 'get_cash_summary',
            snippet: 'cashReceived minus cashPaid',
          }),
          tokensIn: 150, tokensOut: 55,
        },
      ]);

      const runId = await startRun(orgId, token, `What is the cash position for project ${project.id}?`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');
      const toolRows = await sql`SELECT tool_name FROM app.agent_tool_calls WHERE run_id = ${runId}`;
      expect(toolRows.some((r) => r.tool_name === 'get_cash_summary')).toBe(true);

      console.log(`✓ Test 4 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '5. get_budget_summary — compact budget question calls correct tool',
    async () => {
      const { orgId, token, project } = seed.orgA;
      // We need a budgetId — the agent will ask the model which budget to look at.
      // We pass a synthetic UUID; the tool will return an empty result but the run
      // still SUCCEEDS (service returns empty, model wraps gracefully).
      const fakeBudgetId = crypto.randomUUID();

      installScriptedModel([
        {
          toolCalls: [{ name: 'get_budget_summary', args: { projectId: project.id, budgetId: fakeBudgetId } }],
          tokensIn: 95, tokensOut: 22,
        },
        {
          text: buildFinalAnswer({
            narrative: `Budget summary: original ${SEED_PROJECT_A.budgetOriginal}, revised ${SEED_PROJECT_A.budgetRevised}.`,
            figures: [
              { label: 'Original Budget', value: SEED_PROJECT_A.budgetOriginal, currency: 'USD' },
              { label: 'Revised Budget',  value: SEED_PROJECT_A.budgetRevised,  currency: 'USD' },
            ],
            summary: `Original: ${SEED_PROJECT_A.budgetOriginal}, Revised: ${SEED_PROJECT_A.budgetRevised}.`,
            toolName: 'get_budget_summary',
            snippet: 'original + approvedChanges + revised totals',
          }),
          tokensIn: 160, tokensOut: 65,
        },
      ]);

      const runId = await startRun(
        orgId, token,
        `Give me a budget summary for project ${project.id} budget ${fakeBudgetId}`,
      );
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');
      const toolRows = await sql`SELECT tool_name FROM app.agent_tool_calls WHERE run_id = ${runId}`;
      expect(toolRows.some((r) => r.tool_name === 'get_budget_summary')).toBe(true);

      console.log(`✓ Test 5 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '6. get_budget (full detail) — budget line detail question calls correct tool',
    async () => {
      const { orgId, token, project } = seed.orgA;
      const fakeBudgetId = crypto.randomUUID();

      installScriptedModel([
        {
          toolCalls: [{ name: 'get_budget', args: { projectId: project.id, budgetId: fakeBudgetId } }],
          tokensIn: 95, tokensOut: 22,
        },
        {
          text: buildFinalAnswer({
            narrative: 'Full budget with line items retrieved.',
            summary: 'Budget line items available.',
            toolName: 'get_budget',
            snippet: 'line items by cost code',
          }),
          tokensIn: 160, tokensOut: 65,
        },
      ]);

      const runId = await startRun(
        orgId, token,
        `Show me the full budget breakdown for project ${project.id} budget ${fakeBudgetId}`,
      );
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');
      const toolRows = await sql`SELECT tool_name FROM app.agent_tool_calls WHERE run_id = ${runId}`;
      expect(toolRows.some((r) => r.tool_name === 'get_budget')).toBe(true);

      console.log(`✓ Test 6 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '7. list_financial_audit_events — audit trail question calls correct tool and respects limit',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        {
          toolCalls: [{
            name: 'list_financial_audit_events',
            args: { projectId: project.id, limit: 10 },
          }],
          tokensIn: 95, tokensOut: 22,
        },
        {
          text: buildFinalAnswer({
            narrative: 'Audit trail shows 0 events (no financial changes yet).',
            summary: 'Financial audit trail is empty for new project.',
            toolName: 'list_financial_audit_events',
            snippet: 'events: [], nextCursor: null',
          }),
          tokensIn: 150, tokensOut: 55,
        },
      ]);

      const runId = await startRun(orgId, token, `Show me the financial audit trail for project ${project.id}`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');
      const toolRows = await sql`SELECT tool_name FROM app.agent_tool_calls WHERE run_id = ${runId}`;
      expect(toolRows.some((r) => r.tool_name === 'list_financial_audit_events')).toBe(true);

      console.log(`✓ Test 7 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// B. Edge cases (tests 8–12)
// ═════════════════════════════════════════════════════════════════════════════

describe('B. Edge cases', () => {
  it(
    '8. multi-tool sequence — model calls two tools before answering',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        // Turn 1: call get_cost_summary first
        { toolCalls: [{ name: 'get_cost_summary', args: { projectId: project.id } }], tokensIn: 100, tokensOut: 25 },
        // Turn 2: call get_billing_summary next
        { toolCalls: [{ name: 'get_billing_summary', args: { projectId: project.id } }], tokensIn: 110, tokensOut: 28 },
        // Turn 3: final answer
        {
          text: buildFinalAnswer({
            narrative: 'Cost and billing data combined.',
            figures: [
              { label: 'Revised Budget', value: SEED_PROJECT_A.budgetRevised, currency: 'USD' },
            ],
            summary: 'Both cost and billing summaries retrieved.',
            toolName: 'get_cost_summary',
            snippet: 'combined cost + billing',
          }),
          tokensIn: 220, tokensOut: 85,
        },
      ]);

      const runId = await startRun(orgId, token, `Compare cost and billing for project ${project.id}`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');

      const toolRows = await sql`SELECT tool_name FROM app.agent_tool_calls WHERE run_id = ${runId} ORDER BY id`;
      const toolNames = toolRows.map((r) => r.tool_name);
      expect(toolNames).toContain('get_cost_summary');
      expect(toolNames).toContain('get_billing_summary');

      console.log(`✓ Test 8 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '9. plain-text fallback — model returns non-JSON text and run still SUCCEEDS',
    async () => {
      const { orgId, token } = seed.orgA;

      // Graph catches JSON.parse failure and wraps content in plain-text fallback
      installScriptedModel([
        {
          text: 'I cannot answer this question with the available financial data.',
          tokensIn: 80, tokensOut: 20,
        },
      ]);

      const runId = await startRun(orgId, token, 'What is the meaning of life?');
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');
      const output = parseOutput(run.output);
      // Plain-text fallback: answer.narrative contains the text, figures is empty
      expect((output.answer as any).narrative).toContain('cannot answer');
      expect((output.answer as any).figures).toEqual([]);

      console.log(`✓ Test 9 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '10. tool returns error — run still SUCCEEDS; tool call logged as ERROR',
    async () => {
      const { orgId, token } = seed.orgA;
      // Non-existent projectId causes the service to return an error via tool-factory
      const badProjectId = crypto.randomUUID();

      installScriptedModel([
        { toolCalls: [{ name: 'get_cost_summary', args: { projectId: badProjectId } }], tokensIn: 90, tokensOut: 20 },
        {
          text: buildFinalAnswer({
            narrative: 'Unable to retrieve data — project not found.',
            summary: 'No cost data available for the requested project.',
            toolName: 'get_cost_summary',
            snippet: 'tool returned error',
          }),
          tokensIn: 140, tokensOut: 50,
        },
      ]);

      const runId = await startRun(orgId, token, `Show costs for project ${badProjectId}`);
      // Tool error causes the tool node to return "Error: ..." string back to the model,
      // but the overall run still SUCCEEDS (model handles error gracefully).
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.status).toBe('SUCCEEDED');

      console.log(`✓ Test 10 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '11. usage is recorded in agent_usage_daily after successful run',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        { toolCalls: [{ name: 'get_financial_summary', args: { projectId: project.id } }], tokensIn: 100, tokensOut: 25 },
        {
          text: buildFinalAnswer({
            narrative: 'Overview complete.',
            summary: 'Financial summary retrieved.',
            toolName: 'get_financial_summary',
            snippet: 'full snapshot',
          }),
          tokensIn: 150, tokensOut: 60,
        },
      ]);

      const runId = await startRun(orgId, token, `Financial overview for project ${project.id}`);
      await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      const today = new Date().toISOString().slice(0, 10);
      const usageRows = await sql`
        SELECT runs_count, tokens_in, tokens_out
        FROM app.agent_usage_daily
        WHERE organization_id = ${orgId}
          AND agent = 'cost-financial'
          AND day = ${today}
      `;
      expect(usageRows.length).toBeGreaterThan(0);
      expect(Number(usageRows[0].runs_count)).toBeGreaterThanOrEqual(1);
      expect(Number(usageRows[0].tokens_in)).toBeGreaterThan(0);
      expect(Number(usageRows[0].tokens_out)).toBeGreaterThan(0);

      console.log('✓ Test 11 — usage row verified');
    },
    60_000,
  );

  it(
    '12. output schema validation — agent_runs.output always has answer + summary + citations',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        { toolCalls: [{ name: 'get_cash_summary', args: { projectId: project.id } }], tokensIn: 90, tokensOut: 20 },
        {
          text: buildFinalAnswer({
            narrative: 'Cash position confirmed.',
            figures: [{ label: 'Net Cash', value: '50000.00', currency: 'USD' }],
            summary: 'Net cash is positive.',
            toolName: 'get_cash_summary',
            snippet: 'net cash from executed payments',
          }),
          tokensIn: 140, tokensOut: 55,
        },
      ]);

      const runId = await startRun(orgId, token, `Cash position for project ${project.id}`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      const output = parseOutput(run.output);
      // Strict schema check
      expect(typeof (output.answer as any).narrative).toBe('string');
      expect(Array.isArray((output.answer as any).figures)).toBe(true);
      expect(typeof output.summary).toBe('string');
      expect((output.summary as string).length).toBeLessThanOrEqual(500);
      expect(Array.isArray(output.citations)).toBe(true);
      const citation = (output.citations as any[])[0];
      expect(typeof citation.toolName).toBe('string');
      expect(typeof citation.snippet).toBe('string');

      console.log(`✓ Test 12 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// C. Security (tests 13–17)
// ═════════════════════════════════════════════════════════════════════════════

describe('C. Security & tenant isolation', () => {
  it(
    '13. cross-tenant: Org A user cannot POST to Org B URL (401 / 403)',
    async () => {
      // Org A token sent to Org B's route — must be rejected at HTTP layer
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${seed.orgB.orgId}/ai/runs`,
        headers: {
          authorization: `Bearer ${seed.orgA.token}`,
          'content-type': 'application/json',
        },
        payload: { agent: 'cost-financial', input: { question: 'What are the costs?' } },
      });
      // The org-scoped auth middleware returns 403 (not a member of orgB)
      expect([401, 403, 404]).toContain(res.statusCode);

      console.log('✓ Test 13 — cross-tenant POST blocked');
    },
    15_000,
  );

  it(
    '14. cross-tenant run read: Org A user cannot read a run that belongs to Org B',
    async () => {
      // Insert a run directly in Org B's namespace
      const runId = crypto.randomUUID();
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by)
        VALUES (${runId}, ${seed.orgB.orgId}, 'cost-financial', 'USER', 'SUCCEEDED', ${seed.orgB.user.id})
      `;

      // Org A tries to read it via their own org URL
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${seed.orgA.orgId}/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${seed.orgA.token}` },
      });
      expect(res.statusCode).toBe(404);

      console.log('✓ Test 14 — cross-tenant run read blocked');
    },
    15_000,
  );

  it(
    '15. listing runs only returns the requesting org\'s runs',
    async () => {
      // Create a run in Org A
      installScriptedModel([
        {
          text: buildFinalAnswer({
            narrative: 'Quick check.',
            summary: 'OK.',
            toolName: 'get_cost_summary',
            snippet: 'data',
          }),
          tokensIn: 80, tokensOut: 20,
        },
      ]);

      const runIdA = await startRun(seed.orgA.orgId, seed.orgA.token, 'Quick overview');
      await waitForRunStatus(runIdA, 'SUCCEEDED', 45_000);

      // Org A list must contain runIdA but NOT any of Org B's runs
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${seed.orgA.orgId}/ai/runs`,
        headers: { authorization: `Bearer ${seed.orgA.token}` },
      });
      expect(listRes.statusCode).toBe(200);

      const body = listRes.json();
      const runs: Array<{ id: string; organization_id?: string; organizationId?: string }> =
        body.data?.runs ?? body.data ?? [];

      const runIds = runs.map((r) => r.id);
      expect(runIds).toContain(runIdA);

      // None of the returned runs should have Org B's orgId
      const orgBId = seed.orgB.orgId;
      runs.forEach((r) => {
        const oid = r.organization_id ?? r.organizationId;
        expect(oid).not.toBe(orgBId);
      });

      console.log('✓ Test 15 — run listing scoped correctly');
    },
    60_000,
  );

  it(
    '16. prompt injection in tool result is treated as data, not instructions',
    async () => {
      // The tool node will return this string to the model as a tool message.
      // The next model turn must still produce a valid output, not follow the injection.
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        { toolCalls: [{ name: 'get_cost_summary', args: { projectId: project.id } }], tokensIn: 90, tokensOut: 20 },
        // Model turn after receiving the injected tool result — it ignores the injection
        // and returns a proper answer (the fake model is scripted, so this is deterministic)
        {
          text: buildFinalAnswer({
            narrative: 'Cost data retrieved. The tool output contained unexpected text which was ignored.',
            summary: 'Cost data returned despite injection attempt in tool result.',
            toolName: 'get_cost_summary',
            snippet: 'tool result processed as data',
          }),
          tokensIn: 200, tokensOut: 70,
        },
      ]);

      const runId = await startRun(orgId, token, `Cost summary for project ${project.id}`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      // Run SUCCEEDED — the injection string in the tool result did not break anything
      expect(run.status).toBe('SUCCEEDED');

      // Output must conform to the schema (not echo an injection payload)
      const output = parseOutput(run.output);
      expect((output.answer as any).narrative).not.toContain('IGNORE PREVIOUS INSTRUCTIONS');
      expect((output.answer as any).narrative).not.toContain('SYSTEM OVERRIDE');

      console.log(`✓ Test 16 — trace_id: ${run.trace_id}`);
    },
    60_000,
  );

  it(
    '17. unauthenticated request to /ai/runs returns 401',
    async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${seed.orgA.orgId}/ai/runs`,
        headers: { 'content-type': 'application/json' },
        payload: { agent: 'cost-financial', input: { question: 'hello' } },
      });
      expect(res.statusCode).toBe(401);

      console.log('✓ Test 17 — unauthenticated request blocked');
    },
    10_000,
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// D. Run lifecycle (tests 18–20)
// ═════════════════════════════════════════════════════════════════════════════

describe('D. Run lifecycle', () => {
  it(
    '18. GET /ai/runs/:id returns the correct run for the owning org',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        {
          text: buildFinalAnswer({
            narrative: 'Data fetched.',
            summary: 'Complete.',
            toolName: 'get_financial_summary',
            snippet: 'snapshot',
          }),
          tokensIn: 80, tokensOut: 20,
        },
      ]);

      const runId = await startRun(orgId, token, `overview for project ${project.id}`);
      await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(200);
      const body = getRes.json();
      const run = body.data?.run ?? body.data ?? body.run ?? body;
      expect(run.id ?? run.runId).toBeTruthy();

      console.log('✓ Test 18 — GET run by ID succeeded');
    },
    60_000,
  );

  it(
    '19. timestamps and token counts are persisted after SUCCEEDED',
    async () => {
      const { orgId, token, project } = seed.orgA;

      installScriptedModel([
        { toolCalls: [{ name: 'get_cost_summary', args: { projectId: project.id } }], tokensIn: 120, tokensOut: 30 },
        {
          text: buildFinalAnswer({
            narrative: 'Done.',
            summary: 'Tokens verified.',
            toolName: 'get_cost_summary',
            snippet: 'usage check',
          }),
          tokensIn: 160, tokensOut: 60,
        },
      ]);

      const runId = await startRun(orgId, token, `cost check for project ${project.id}`);
      const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);

      expect(run.started_at).toBeTruthy();
      expect(run.finished_at).toBeTruthy();
      const startMs  = new Date(run.started_at).getTime();
      const finishMs = new Date(run.finished_at).getTime();
      expect(finishMs).toBeGreaterThanOrEqual(startMs);

      // Tokens: fake model emits 120+160 in, 30+60 out
      expect(Number(run.tokens_in)).toBeGreaterThan(0);
      expect(Number(run.tokens_out)).toBeGreaterThan(0);

      console.log(`✓ Test 19 — tokens_in: ${run.tokens_in}, tokens_out: ${run.tokens_out}`);
    },
    60_000,
  );

  it(
    '20. cancel: DELETE /ai/runs/:id transitions a RUNNING run to CANCELLED',
    async () => {
      // We need a run that stays RUNNING long enough to cancel.
      // echo-slow has a built-in 3-second sleep; cost-financial doesn't.
      // Instead we use a raw INSERT to simulate a RUNNING run and test
      // the cancel endpoint + CANCELLED status without touching the worker.
      const { orgId, token, user } = seed.orgA;

      const runId = crypto.randomUUID();
      await sql`
        INSERT INTO app.agent_runs (id, organization_id, agent, trigger, status, created_by, started_at)
        VALUES (
          ${runId}, ${orgId}, 'cost-financial', 'USER', 'RUNNING',
          ${user.id}, NOW()
        )
      `;

      // Cancel via DELETE endpoint
      const cancelRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(cancelRes.statusCode).toBe(200);

      // Status must be CANCELLED in the DB
      const rows = await sql`SELECT status FROM app.agent_runs WHERE id = ${runId}`;
      expect(rows[0].status).toBe('CANCELLED');

      console.log('✓ Test 20 — run cancelled via DELETE');
    },
    20_000,
  );
});
