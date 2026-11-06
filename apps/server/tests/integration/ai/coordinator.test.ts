// apps/server/tests/integration/ai/coordinator.test.ts
//
// Integration tests for Coordinator Agent
// Tests routing logic, sub-run creation, and output formatting

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentRunService } from '../../../src/modules/ai/runs/agent-run.service.js';
import type { CoordinatorOutput } from '../../../src/modules/ai/agents/coordinator/output.schema.js';

// ── Test Configuration ────────────────────────────────────────────────────────

const TEST_CONFIG = {
  organizationId: process.env.TEST_ORG_ID || 'org_test',
  projectId: process.env.TEST_PROJECT_ID || 'proj_test',
  userId: process.env.TEST_USER_ID || 'user_test',
  timeout: 120000, // 2 minutes per test
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Coordinator Agent Integration Tests', () => {
  let runService: AgentRunService;

  beforeAll(() => {
    runService = new AgentRunService();
  });

  // ── Helper ──────────────────────────────────────────────────────────────────

  async function runCoordinator(question: string, expectedAgent?: string) {
    const { runId } = await runService.startRun({
      organizationId: TEST_CONFIG.organizationId,
      projectId: TEST_CONFIG.projectId,
      agent: 'coordinator',
      trigger: 'API',
      channel: 'api',
      input: { question },
      createdBy: TEST_CONFIG.userId,
    });

    // Wait for completion
    const maxWaitMs = TEST_CONFIG.timeout;
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    let run = await runService.getRun(runId, TEST_CONFIG.organizationId);

    while (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`Run timeout after ${maxWaitMs}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      run = await runService.getRun(runId, TEST_CONFIG.organizationId);
    }

    expect(run.status).toBe('SUCCEEDED');
    expect(run.outputSnapshot).toBeDefined();

    const output = run.outputSnapshot as CoordinatorOutput;

    // Validate output structure
    expect(output).toHaveProperty('routedTo');
    expect(output).toHaveProperty('response');
    expect(output).toHaveProperty('metadata');
    expect(output.routedTo).toHaveProperty('agent');
    expect(output.routedTo).toHaveProperty('reason');
    expect(output.response).toHaveProperty('summary');
    expect(output.response).toHaveProperty('details');
    expect(output.metadata).toHaveProperty('subRunId');
    expect(output.metadata).toHaveProperty('subRunStatus');

    // Validate routing if expected agent provided
    if (expectedAgent) {
      expect(output.routedTo.agent).toBe(expectedAgent);
    }

    return { run, output };
  }

  // ── Test Cases ──────────────────────────────────────────────────────────────

  it(
    'should route compliance questions to compliance agent',
    async () => {
      const { output } = await runCoordinator(
        'What permits are required for this construction project?',
        'compliance',
      );

      expect(output.routedTo.agent).toBe('compliance');
      expect(output.routedTo.reason).toBeTruthy();
      expect(output.metadata.subRunStatus).toBe('SUCCEEDED');
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should route estimating questions to estimating-boq agent',
    async () => {
      const { output } = await runCoordinator(
        'How much concrete do we need for the foundation?',
        'estimating-boq',
      );

      expect(output.routedTo.agent).toBe('estimating-boq');
      expect(output.metadata.subRunStatus).toBe('SUCCEEDED');
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should route cost questions to cost-financial agent',
    async () => {
      const { output } = await runCoordinator(
        "What's the current budget status?",
        'cost-financial',
      );

      expect(output.routedTo.agent).toBe('cost-financial');
      expect(output.metadata.subRunStatus).toBe('SUCCEEDED');
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should route procurement questions to procurement agent',
    async () => {
      const { output } = await runCoordinator(
        'What materials are on order?',
        'procurement',
      );

      expect(output.routedTo.agent).toBe('procurement');
      expect(output.metadata.subRunStatus).toBe('SUCCEEDED');
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should route report requests to reports agent',
    async () => {
      const { output } = await runCoordinator(
        'Generate a project health report',
        'reports',
      );

      expect(output.routedTo.agent).toBe('reports');
      expect(output.metadata.subRunStatus).toBe('SUCCEEDED');
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should handle ambiguous questions gracefully',
    async () => {
      const { output } = await runCoordinator('Tell me about the project');

      // Should route to some agent (likely reports for overview)
      expect(output.routedTo.agent).toBeTruthy();
      expect(['reports', 'cost-financial', 'compliance']).toContain(output.routedTo.agent);
      expect(output.routedTo.reason).toBeTruthy();
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should include sub-run metadata in output',
    async () => {
      const { output } = await runCoordinator('Show me pending purchase orders');

      expect(output.metadata.subRunId).toMatch(/^run_/);
      expect(output.metadata.subRunStatus).toBe('SUCCEEDED');
      expect(output.response.summary).toBeTruthy();
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should provide reasoning for routing decision',
    async () => {
      const { output } = await runCoordinator('What are the OSHA requirements?');

      expect(output.routedTo.agent).toBe('compliance');
      expect(output.routedTo.reason).toContain('compliance'); // Reasoning should mention compliance
      expect(output.routedTo.reason.length).toBeGreaterThan(10);
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should handle budget-related questions',
    async () => {
      const { output } = await runCoordinator('Are we over or under budget?');

      expect(output.routedTo.agent).toBe('cost-financial');
      expect(output.response.summary).toBeTruthy();
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should handle BOQ/quantity questions',
    async () => {
      const { output } = await runCoordinator("What's the quantity of rebar in the structural BOQ?");

      expect(output.routedTo.agent).toBe('estimating-boq');
      expect(output.response.summary).toBeTruthy();
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should list available agents when requested',
    async () => {
      // This tests the list_available_agents tool
      const { output } = await runCoordinator('What agents are available?');

      // Coordinator should route to itself or provide list info
      expect(output.response.summary).toBeTruthy();
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should handle schedule-related questions',
    async () => {
      const { output } = await runCoordinator("What's in the schedule variance report?");

      expect(output.routedTo.agent).toBe('reports');
      expect(output.response.summary).toBeTruthy();
    },
    TEST_CONFIG.timeout,
  );
});

// ── Edge Cases ────────────────────────────────────────────────────────────────

describe('Coordinator Edge Cases', () => {
  let runService: AgentRunService;

  beforeAll(() => {
    runService = new AgentRunService();
  });

  it(
    'should handle empty question',
    async () => {
      const { runId } = await runService.startRun({
        organizationId: TEST_CONFIG.organizationId,
        projectId: TEST_CONFIG.projectId,
        agent: 'coordinator',
        trigger: 'API',
        channel: 'api',
        input: { question: '' },
        createdBy: TEST_CONFIG.userId,
      });

      const maxWaitMs = TEST_CONFIG.timeout;
      const pollIntervalMs = 2000;
      const startTime = Date.now();

      let run = await runService.getRun(runId, TEST_CONFIG.organizationId);

      while (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(run.status)) {
        if (Date.now() - startTime > maxWaitMs) {
          throw new Error(`Run timeout after ${maxWaitMs}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        run = await runService.getRun(runId, TEST_CONFIG.organizationId);
      }

      // Should either succeed with some default routing or fail gracefully
      expect(['SUCCEEDED', 'FAILED']).toContain(run.status);
    },
    TEST_CONFIG.timeout,
  );

  it(
    'should handle very long questions',
    async () => {
      const longQuestion =
        'What are all the permits required for this construction project including building permits, electrical permits, plumbing permits, mechanical permits, fire safety permits, environmental permits, and any other regulatory approvals needed? ' +
        'Also, what are the inspection schedules, compliance requirements, OSHA regulations, safety protocols, quality standards, and documentation needed for each permit type?';

      const { runId } = await runService.startRun({
        organizationId: TEST_CONFIG.organizationId,
        projectId: TEST_CONFIG.projectId,
        agent: 'coordinator',
        trigger: 'API',
        channel: 'api',
        input: { question: longQuestion },
        createdBy: TEST_CONFIG.userId,
      });

      const maxWaitMs = TEST_CONFIG.timeout;
      const pollIntervalMs = 2000;
      const startTime = Date.now();

      let run = await runService.getRun(runId, TEST_CONFIG.organizationId);

      while (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(run.status)) {
        if (Date.now() - startTime > maxWaitMs) {
          throw new Error(`Run timeout after ${maxWaitMs}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        run = await runService.getRun(runId, TEST_CONFIG.organizationId);
      }

      expect(run.status).toBe('SUCCEEDED');
      const output = run.outputSnapshot as CoordinatorOutput;
      expect(output.routedTo.agent).toBe('compliance'); // Should still route correctly
    },
    TEST_CONFIG.timeout,
  );
});
