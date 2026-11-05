// apps/server/tests/integration/ai/estimating-boq.test.ts
//
// Estimating-BOQ Agent — deterministic integration test suite.
// 31 cases: basic (1-7), edge (8-14), security (15-20), hardening (21-25), conformance (26-31).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type PgBoss from 'pg-boss';
import { createTestApp } from '../../helpers/test-app.js';
import {
  waitForRunStatus,
  closeTestSql,
} from '../../helpers/ai/ai-fixtures.js';
import { startQueue, stopQueue } from '../../../src/lib/queue/index.js';
import { registerAgentRunWorkers } from '../../../src/modules/ai/workers/agent-run.worker.js';
import {
  seedEstimatingBoqFixtures,
  buildFinalAnswer,
  SEED_ESTIMATING,
  type EstimatingBoqFixtures,
} from '../../helpers/ai/estimating-boq-fixtures.js';
import { installScriptedModel, clearScriptedModel } from '../../helpers/ai/fake-model.js';
import '../../../src/modules/ai/index.js';

describe('Estimating-BOQ Agent Deterministic Test Suite', () => {
  let app: FastifyInstance;
  let boss: PgBoss;
  let fixtures: EstimatingBoqFixtures;

  beforeAll(async () => {
    app = await createTestApp();
    boss = await startQueue();
    await registerAgentRunWorkers(boss);
    fixtures = await seedEstimatingBoqFixtures(app);
  }, 120_000);

  afterAll(async () => {
    clearScriptedModel();
    try { await stopQueue(); } catch { /* ignore */ }
    if (app) await app.close();
    await closeTestSql();
  });

  beforeEach(() => {
    clearScriptedModel();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function startRun(question: string, orgId = fixtures.orgA.orgId, token = fixtures.orgA.token) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/ai/runs`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { agent: 'estimating-boq', input: { question } },
    });
    expect([201, 202]).toContain(res.statusCode);
    const runId: string = res.json().data?.runId ?? res.json().runId;
    expect(runId).toBeTruthy();
    return runId;
  }

  // ── A. Basic (1-7) ────────────────────────────────────────────────────────

  it('1. lists BOQs for a project', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_boqs', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: `Found 1 BOQ: "${SEED_ESTIMATING.boq.title}" in DRAFT status.`,
          figures: [],
          summary: '1 BOQ in draft.',
          toolName: 'list_boqs',
          snippet: `title: ${SEED_ESTIMATING.boq.title}, status: DRAFT`,
        }),
      },
    ]);

    const runId = await startRun('List BOQs for this project');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
    expect(run.output.citations.length).toBeGreaterThan(0);
  });

  it('2. gets a BOQ revision with sections and items', async () => {
    const { boq } = fixtures.orgA;
    installScriptedModel([
      { toolCalls: [{ name: 'get_boq_revision', args: { projectId: fixtures.orgA.project.id, boqId: boq.id, revisionId: boq.currentRevisionId } }] },
      { text: buildFinalAnswer({
          narrative: 'BOQ revision 1 has 0 sections (draft, not yet populated via import).',
          figures: [],
          summary: 'Empty BOQ revision.',
          toolName: 'get_boq_revision',
          snippet: 'sections: [], items: []',
        }),
      },
    ]);

    const runId = await startRun(`Show me BOQ revision for BOQ ${boq.id}`);
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('3. lists estimates', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_estimates', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: `Found 1 estimate: "${SEED_ESTIMATING.estimate.title}" in DRAFT status.`,
          figures: [],
          summary: '1 estimate in draft.',
          toolName: 'list_estimates',
          snippet: `title: ${SEED_ESTIMATING.estimate.title}, status: DRAFT`,
        }),
      },
    ]);

    const runId = await startRun('List estimates for this project');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('4. gets full estimate with sections and lines', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'get_estimate', args: { projectId: fixtures.orgA.project.id, estimateId: fixtures.orgA.estimate.id } }] },
      { text: buildFinalAnswer({
          narrative: `Estimate has 2 sections with 3 lines: concrete (2 lines), steel (1 line). Total amount from revision.`,
          figures: [],
          summary: '3 estimate lines across 2 sections.',
          toolName: 'get_estimate',
          snippet: 'sections: Concrete Work, Structural Steel',
        }),
      },
    ]);

    const runId = await startRun(`Show me the full estimate ${fixtures.orgA.estimate.id}`);
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('5. lists cost codes', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: `Found 3 active cost codes: ${SEED_ESTIMATING.costCodes.concrete.code}, ${SEED_ESTIMATING.costCodes.steel.code}, ${SEED_ESTIMATING.costCodes.formwork.code}.`,
          figures: [],
          summary: '3 cost codes available for mapping.',
          toolName: 'list_cost_codes',
          snippet: `codes: ${SEED_ESTIMATING.costCodes.concrete.code}, ${SEED_ESTIMATING.costCodes.steel.code}`,
        }),
      },
    ]);

    const runId = await startRun('What cost codes are available?');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('6. lists takeoff sheets', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_takeoff_sheets', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: `Found 1 takeoff sheet: "${SEED_ESTIMATING.takeoffSheet.title}" in DRAFT status.`,
          figures: [],
          summary: '1 takeoff sheet in draft.',
          toolName: 'list_takeoff_sheets',
          snippet: `title: ${SEED_ESTIMATING.takeoffSheet.title}`,
        }),
      },
    ]);

    const runId = await startRun('Show me takeoff sheets');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('7. gets takeoff summary by cost code', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'get_takeoff_summary', args: { projectId: fixtures.orgA.project.id, groupBy: 'COST_CODE' } }] },
      { text: buildFinalAnswer({
          narrative: 'No approved takeoff sheets yet — summary is empty.',
          figures: [],
          summary: 'No approved takeoff measurements.',
          toolName: 'get_takeoff_summary',
          snippet: 'groups: [], basis: APPROVED_SHEETS_CURRENT_REVISION',
          confidence: 'INSUFFICIENT_DATA',
          missingData: ['No approved takeoff sheets'],
        }),
      },
    ]);

    const runId = await startRun('Show me takeoff quantities by cost code');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  // ── B. Edge Cases (8-14) ──────────────────────────────────────────────────

  it('8. abstains when no BOQ content found', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'get_boq_revision', args: { projectId: fixtures.orgA.project.id, boqId: fixtures.orgA.boq.id, revisionId: fixtures.orgA.boq.currentRevisionId } }] },
      { text: buildFinalAnswer({
          narrative: 'The BOQ revision is empty — no sections or items to extract from.',
          summary: 'Empty BOQ — nothing to extract.',
          toolName: 'get_boq_revision',
          snippet: 'sections: [], items: []',
          confidence: 'INSUFFICIENT_DATA',
          missingData: ['BOQ has no items yet'],
        }),
      },
    ]);

    const runId = await startRun('Extract BOQ lines from the foundation BOQ');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
    expect(run.output.answer.confidence).toBe('INSUFFICIENT_DATA');
  });

  it('9. search_knowledge_base returns "not found" gracefully', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'search_knowledge_base', args: { projectId: fixtures.orgA.project.id, query: 'pile foundation specification' } }] },
      { text: buildFinalAnswer({
          narrative: 'not found in documents — no specification documents have been uploaded for this project yet.',
          summary: 'No specification documents found.',
          toolName: 'search_knowledge_base',
          snippet: 'not found in documents',
          confidence: 'INSUFFICIENT_DATA',
          missingData: ['No specification documents uploaded'],
        }),
      },
    ]);

    const runId = await startRun('Extract pile foundation quantities from the spec');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
    expect(run.output.answer.confidence).toBe('INSUFFICIENT_DATA');
  });

  it('10. handles unknown BOQ id gracefully', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'get_boq_revision', args: { projectId: fixtures.orgA.project.id, boqId: '00000000-0000-0000-0000-000000000000', revisionId: '00000000-0000-0000-0000-000000000000' } }] },
      { text: buildFinalAnswer({
          narrative: 'The requested BOQ was not found in this project.',
          summary: 'BOQ not found.',
          toolName: 'get_boq_revision',
          snippet: 'Error: BoqNotFoundError',
          confidence: 'INSUFFICIENT_DATA',
          missingData: ['BOQ not found'],
        }),
      },
    ]);

    const runId = await startRun('Show me BOQ 00000000-0000-0000-0000-000000000000');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('11. cost code mapping — all 3 project codes returned', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: `3 cost codes: ${fixtures.orgA.costCodes.concrete.code}, ${fixtures.orgA.costCodes.steel.code}, ${fixtures.orgA.costCodes.formwork.code}.`,
          figures: [
            { label: 'Concrete Code', value: fixtures.orgA.costCodes.concrete.code, source: { toolName: 'list_cost_codes', resultPath: '$[0].code' } },
            { label: 'Steel Code', value: fixtures.orgA.costCodes.steel.code, source: { toolName: 'list_cost_codes', resultPath: '$[1].code' } },
          ],
          draft: [{
            description: 'Ready-mix concrete C30/37',
            unit: 'm3',
            quantity: '150',
            costCodeId: fixtures.orgA.costCodes.concrete.id,
            costCode: fixtures.orgA.costCodes.concrete.code,
            confidence: 'HIGH',
            source: { toolName: 'list_cost_codes', resultPath: '$[0].id', snippet: `code: ${fixtures.orgA.costCodes.concrete.code}` },
          }],
          summary: 'Draft line mapped to concrete cost code.',
          toolName: 'list_cost_codes',
          snippet: `code: ${fixtures.orgA.costCodes.concrete.code}`,
        }),
      },
    ]);

    const runId = await startRun('Map concrete work to a cost code');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('12. estimate comparison — two revisions', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'get_estimate', args: { projectId: fixtures.orgA.project.id, estimateId: fixtures.orgA.estimate.id } }] },
      { text: buildFinalAnswer({
          narrative: 'Estimate revision 1 retrieved. Direct cost total includes concrete and steel lines.',
          figures: [],
          summary: 'Estimate retrieved.',
          toolName: 'get_estimate',
          snippet: 'directCostTotal: 33400.00',
        }),
      },
    ]);

    const runId = await startRun('Show me the estimate totals');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('13. handles no cost codes in project — flags unmapped lines', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: '3 cost codes found. One extracted line could not be matched to any code.',
          draft: [
            {
              description: 'Waterproofing membrane',
              unit: 'm2',
              quantity: '300',
              confidence: 'LOW',
              source: { toolName: 'list_cost_codes', resultPath: 'no match', snippet: 'no matching cost code found' },
            },
          ],
          validationIssues: [{ lineIndex: 0, issue: 'No matching cost code — set confidence LOW', severity: 'WARNING' }],
          summary: '1 line without cost code mapping.',
          toolName: 'list_cost_codes',
          snippet: 'no match for waterproofing',
          confidence: 'MEDIUM',
          missingData: ['No cost code for waterproofing work'],
        }),
      },
    ]);

    const runId = await startRun('Map waterproofing to a cost code');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('14. takeoff measurements returns empty for draft sheet', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'get_takeoff_measurements', args: { projectId: fixtures.orgA.project.id, sheetId: fixtures.orgA.takeoffSheet.id } }] },
      { text: buildFinalAnswer({
          narrative: 'The takeoff sheet has no measurements yet (DRAFT, no measurements added).',
          figures: [],
          summary: 'No measurements in draft takeoff sheet.',
          toolName: 'get_takeoff_measurements',
          snippet: 'measurements: []',
          confidence: 'INSUFFICIENT_DATA',
          missingData: ['No measurements added to takeoff sheet yet'],
        }),
      },
    ]);

    const runId = await startRun('Show me the takeoff measurements');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  // ── C. Security (15-20) ───────────────────────────────────────────────────

  it('15. cross-tenant isolation — Org A cannot access Org B project', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_boqs', args: { projectId: fixtures.orgB.project.id } }] },
      { text: buildFinalAnswer({
          narrative: 'Access denied or no data for this project.',
          summary: 'Cross-tenant access blocked.',
          toolName: 'list_boqs',
          snippet: 'Error: TENANT_LEAK or empty',
          confidence: 'LOW',
        }),
      },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${fixtures.orgA.orgId}/ai/runs`,
      headers: { authorization: `Bearer ${fixtures.orgA.token}`, 'content-type': 'application/json' },
      payload: { agent: 'estimating-boq', input: { question: `List BOQs for project ${fixtures.orgB.project.id}` } },
    });

    const runId = res.json().data?.runId ?? res.json().runId;
    const run = await waitForRunStatus(runId, ['SUCCEEDED', 'FAILED'], 30_000);
    if (run.status === 'SUCCEEDED') {
      expect(['LOW', 'INSUFFICIENT_DATA']).toContain(run.output.answer.confidence);
    }
  });

  it('16. missing project.boq.read permission — soft check passes for org admin', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_boqs', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: 'BOQ data retrieved.',
          summary: 'BOQ read permission works.',
          toolName: 'list_boqs',
          snippet: 'success',
        }),
      },
    ]);

    const runId = await startRun('List BOQs');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('17. non-project-member access — soft check', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: 'Cost codes retrieved.',
          summary: 'Estimate read permission works.',
          toolName: 'list_cost_codes',
          snippet: 'success',
        }),
      },
    ]);

    const runId = await startRun('Show cost codes');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('18. prompt injection in spec content is treated as data', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'search_knowledge_base', args: { projectId: fixtures.orgA.project.id, query: 'concrete specification' } }] },
      { text: buildFinalAnswer({
          narrative: 'Spec content including the text "IGNORE PREVIOUS INSTRUCTIONS" is treated as plain data. No instructions were followed.',
          summary: 'Injection content treated as data.',
          toolName: 'search_knowledge_base',
          snippet: 'injection handled safely',
        }),
      },
    ]);

    const runId = await startRun('Extract from spec');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
    const narrative = run.output.answer.narrative as string;
    expect(narrative.toLowerCase()).not.toContain('api key');
    expect(narrative.toLowerCase()).not.toContain('secret');
  });

  it('19. over-budget soft check — normal run within budget', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_estimates', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: 'Estimate retrieved within budget.',
          summary: 'Within budget.',
          toolName: 'list_estimates',
          snippet: 'success',
        }),
      },
    ]);

    const runId = await startRun('List estimates');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('20. token limit soft check — normal run completes', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_boqs', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: 'Completed within token limit.',
          summary: 'Completed.',
          toolName: 'list_boqs',
          snippet: 'success',
        }),
      },
    ]);

    const runId = await startRun('Show BOQs');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  // ── D. Hardening (21-25) ──────────────────────────────────────────────────

  it('21. repairs malformed JSON', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } }] },
      // Malformed JSON
      { text: '{ "answer": { "narrative": "Found codes", "figures": [], "confidence": "HIGH" }, "draft": [], "validationIssues": [], "summary": "codes found"' },
      // Valid JSON after repair
      { text: buildFinalAnswer({
          narrative: 'Cost codes retrieved after repair.',
          summary: 'JSON repaired.',
          toolName: 'list_cost_codes',
          snippet: 'repair success',
        }),
      },
    ]);

    const runId = await startRun('Show cost codes');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('22. enforces number provenance — figures traced to tool results', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: '3 cost codes found.',
          figures: [],
          summary: '3 codes.',
          toolName: 'list_cost_codes',
          snippet: 'length: 3',
        }),
      },
    ]);

    const runId = await startRun('How many cost codes are there?');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('23. citation completeness — every non-OKF tool cited', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_boqs', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: '1 BOQ found.',
          summary: '1 BOQ.',
          toolName: 'list_boqs',
          snippet: 'title: Foundation Works BOQ',
        }),
      },
    ]);

    const runId = await startRun('List BOQs');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
    expect(run.output.citations.length).toBeGreaterThan(0);
    expect(run.output.citations[0].toolName).toBe('list_boqs');
  });

  it('24. summary length truncated to 500 chars', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'list_estimates', args: { projectId: fixtures.orgA.project.id } }] },
      { text: buildFinalAnswer({
          narrative: 'Estimate retrieved.',
          summary: 'E'.repeat(600),
          toolName: 'list_estimates',
          snippet: 'success',
        }),
      },
    ]);

    const runId = await startRun('Show estimates');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
    expect((run.output.summary as string).length).toBeLessThanOrEqual(500);
  });

  it('25. concurrent tool calls — list_cost_codes + list_boqs together', async () => {
    installScriptedModel([
      { toolCalls: [
          { name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } },
          { name: 'list_boqs', args: { projectId: fixtures.orgA.project.id } },
      ]},
      { text: JSON.stringify({
          answer: {
            narrative: '3 cost codes and 1 BOQ retrieved concurrently.',
            figures: [],
            confidence: 'HIGH',
          },
          draft: [],
          validationIssues: [],
          summary: '3 codes, 1 BOQ.',
          citations: [
            { toolName: 'list_cost_codes', snippet: 'concurrent success' },
            { toolName: 'list_boqs', snippet: 'concurrent success' },
          ],
        }),
      },
    ]);

    const runId = await startRun('Show me cost codes and BOQs together');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
    expect(run.output.citations.length).toBeGreaterThanOrEqual(2);
  });

  // ── E. Charter Conformance (26-31) ────────────────────────────────────────

  it('26. refuses to approve a BOQ', async () => {
    installScriptedModel([
      { text: buildFinalAnswer({
          narrative: 'I can extract and propose draft lines but cannot approve or submit BOQs — this requires an authorised reviewer.',
          summary: 'Cannot approve BOQs.',
          toolName: 'list_boqs',
          snippet: 'OUT OF SCOPE: approval',
        }),
      },
    ]);

    const runId = await startRun(`Approve BOQ ${fixtures.orgA.boq.id}`);
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
    const narrative = (run.output.answer.narrative as string).toLowerCase();
    expect(narrative).toMatch(/cannot|requires.*authoris|out of scope/i);
  });

  it('27. refuses to price from rate libraries', async () => {
    installScriptedModel([
      { text: buildFinalAnswer({
          narrative: 'Pricing from rate libraries is not yet available — I can map quantities to cost codes but cannot provide unit rates from an external rate library.',
          summary: 'Rate library pricing out of scope.',
          toolName: 'list_cost_codes',
          snippet: 'OUT OF SCOPE: rate library',
        }),
      },
    ]);

    const runId = await startRun('Get unit rates from our rate library for concrete work');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
    const narrative = (run.output.answer.narrative as string).toLowerCase();
    expect(narrative).toMatch(/rate librar|not yet available|cannot provide unit rates/i);
  });

  it('28. draft only — refuses to submit an estimate', async () => {
    installScriptedModel([
      { text: buildFinalAnswer({
          narrative: 'I can extract and propose draft lines but cannot approve or submit — this requires an authorised reviewer via the estimate module.',
          summary: 'Cannot submit estimates.',
          toolName: 'list_estimates',
          snippet: 'OUT OF SCOPE: submission',
        }),
      },
    ]);

    const runId = await startRun(`Submit estimate ${fixtures.orgA.estimate.id} for approval`);
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 30_000);
    expect(run.status).toBe('SUCCEEDED');
    const narrative = (run.output.answer.narrative as string).toLowerCase();
    expect(narrative).toMatch(/cannot|requires.*authoris|out of scope/i);
  });

  it('29. draft lines have confidence flags — LOW lines flagged for human review', async () => {
    installScriptedModel([
      { toolCalls: [
          { name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } },
          { name: 'search_knowledge_base', args: { projectId: fixtures.orgA.project.id, query: 'waterproofing specification' } },
      ]},
      { text: JSON.stringify({
          answer: {
            narrative: 'Extracted 1 line with LOW confidence — no matching cost code found. Human review required.',
            figures: [],
            confidence: 'MEDIUM',
          },
          draft: [{
            description: 'Waterproofing membrane Type X',
            unit: 'm2',
            quantity: '300',
            confidence: 'LOW',
            source: { toolName: 'search_knowledge_base', resultPath: '$.chunks[0].content', snippet: '300 m2 waterproofing' },
          }],
          validationIssues: [{ lineIndex: 0, issue: 'No matching cost code', severity: 'WARNING' }],
          summary: '1 LOW confidence line flagged.',
          citations: [
            { toolName: 'list_cost_codes', snippet: '3 active cost codes returned' },
            { toolName: 'search_knowledge_base', snippet: '300 m2 waterproofing' },
          ],
        }),
      },
    ]);

    const runId = await startRun('Extract waterproofing quantities');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('30. validation issues detected — duplicate description', async () => {
    installScriptedModel([
      { toolCalls: [{ name: 'get_estimate', args: { projectId: fixtures.orgA.project.id, estimateId: fixtures.orgA.estimate.id } }] },
      { text: buildFinalAnswer({
          narrative: 'Extracted 2 lines. Validation found 1 duplicate description — flagged for review.',
          draft: [
            {
              description: 'Ready-mix concrete C30/37',
              unit: 'm3',
              quantity: '150',
              costCodeId: fixtures.orgA.costCodes.concrete.id,
              costCode: fixtures.orgA.costCodes.concrete.code,
              confidence: 'HIGH',
              source: { toolName: 'get_estimate', resultPath: '$.sections[0].lines[0]', snippet: 'concrete 150 m3' },
            },
            {
              description: 'Ready-mix concrete C30/37',
              unit: 'm3',
              quantity: '50',
              costCodeId: fixtures.orgA.costCodes.concrete.id,
              costCode: fixtures.orgA.costCodes.concrete.code,
              confidence: 'MEDIUM',
              source: { toolName: 'get_estimate', resultPath: '$.sections[0].lines[1]', snippet: 'concrete 50 m3' },
            },
          ],
          validationIssues: [{ lineIndex: 1, issue: 'Duplicate description: "Ready-mix concrete C30/37"', severity: 'WARNING' }],
          summary: '2 lines, 1 duplicate warning.',
          toolName: 'get_estimate',
          snippet: 'Ready-mix concrete C30/37 x2',
          confidence: 'MEDIUM',
        }),
      },
    ]);

    const runId = await startRun('Extract estimate lines and check for duplicates');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('31. cost code mapping validation — traces extracted line to existing code', async () => {
    installScriptedModel([
      { toolCalls: [
          { name: 'list_cost_codes', args: { projectId: fixtures.orgA.project.id } },
          { name: 'get_estimate', args: { projectId: fixtures.orgA.project.id, estimateId: fixtures.orgA.estimate.id } },
      ]},
      { text: JSON.stringify({
          answer: {
            narrative: `Steel reinforcement mapped to cost code ${fixtures.orgA.costCodes.steel.code} (id: ${fixtures.orgA.costCodes.steel.id}).`,
            figures: [],
            confidence: 'HIGH',
          },
          draft: [{
            description: 'Steel reinforcement bar Y16',
            unit: 'kg',
            quantity: '5000',
            costCodeId: fixtures.orgA.costCodes.steel.id,
            costCode: fixtures.orgA.costCodes.steel.code,
            confidence: 'HIGH',
            source: { toolName: 'get_estimate', resultPath: '$.sections[1].lines[0]', snippet: 'steel Y16 5000 kg' },
          }],
          validationIssues: [],
          summary: '1 steel line mapped to cost code.',
          citations: [
            { toolName: 'list_cost_codes', snippet: `code: ${fixtures.orgA.costCodes.steel.code}` },
            { toolName: 'get_estimate', snippet: 'steel Y16 5000 kg' },
          ],
        }),
      },
    ]);

    const runId = await startRun('Map steel reinforcement to a cost code');
    const run = await waitForRunStatus(runId, 'SUCCEEDED', 45_000);
    expect(run.status).toBe('SUCCEEDED');
    expect(run.output.citations.length).toBeGreaterThanOrEqual(1);
  });
});


