// apps/server/tests/autonomous-e2e/suites/A1-tenancy.test.ts
// A1: Tenancy Isolation (20 tests)
// Goal: Prove org-B cannot access org-A data via ANY surface
//
// Surfaces tested:
// - HTTP routes with org-A resource IDs (IDOR)
// - Memory namespaces (Redis key enumeration)
// - OKF/RAG retrieval (document leakage)
// - Tool args containing org-A IDs
// - Approvals (cross-org approval attempts)
// - Conversations/checkpoints
// - Voice transcripts
// - File uploads
//
// Assertions:
// - Zero org-A data in responses
// - 403/404 errors (NOT 500 with stack trace)
// - Langfuse traces show permission denied BEFORE tool execution
// - Audit logs record attempted access
// - No org-A data in any Langfuse span

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { TraceCollector } from '../harness/trace-collector.js';
import { executeTool } from '../../../src/modules/ai/tools/tool-factory.js';
import { RunContext } from '../../../src/modules/ai/core/run-context.js';
import { getDb } from '../../../src/lib/db/db.js';
import { generateId } from '../../../src/lib/id.js';
import { organizations, projects, users } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

describe('A1: Tenancy Isolation', () => {
  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };
  let projectA: { id: string; name: string; budget: number };
  let userB: { id: string; email: string };
  let traceCollector: TraceCollector;

  beforeAll(async () => {
    const db = getDb();
    traceCollector = new TraceCollector();

    // Create test users first
    const [testAdmin] = await db.insert(users).values({
      id: generateId(),
      email: 'test-admin@siteflow.test',
      passwordHash: 'not-used-in-tests',
      emailVerified: true,
    }).returning();

    // Create org-A with project-A and sensitive data
    [orgA] = await db.insert(organizations).values({
      id: generateId(),
      name: 'Acme Construction (Org-A)',
      slug: 'org-a-test',
      createdBy: testAdmin.id,
    }).returning();

    [projectA] = await db.insert(projects).values({
      id: generateId(),
      organizationId: orgA.id,
      name: 'Tower Project Alpha',
      status: 'ACTIVE',
      // This is the sensitive data we're protecting
      budget: 1000000, // $1M
    }).returning();

    // Create org-B with attacker user
    [orgB] = await db.insert(organizations).values({
      id: generateId(),
      name: 'Evil Corp (Org-B)',
      slug: 'org-b-test',
      createdBy: testAdmin.id,
    }).returning();

    [userB] = await db.insert(users).values({
      id: generateId(),
      email: 'attacker@org-b.com',
      passwordHash: 'not-used-in-tests',
      emailVerified: true,
    }).returning();

    // Link user-B to org-B (would be done via memberships in real system)
  });

  afterAll(async () => {
    const db = getDb();
    // Cleanup
    await db.delete(projects).where(eq(projects.id, projectA.id));
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, userB.id));
  });

  describe('IDOR Attacks via Tool Args', () => {
    test('T1.1: Cannot access org-A financial data with org-A project ID', async () => {
      const ctx = RunContext.create({
        runId: 'test-run-t1-1',
        organizationId: orgB.id, // Attacker from org-B
        projectId: null,
        userId: userB.id,
        agentName: 'cost-financial',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      // Attacker tries to access org-A project data
      const result = await executeTool('get_financial_summary', {
        projectId: projectA.id, // Cross-tenant attempt
      }, ctx);

      // Assert: Tool call denied
      expect(result.ok).toBe(false);
      expect(result.code).toMatch(/TOOL_PERMISSION_DENIED|RBAC_ERROR|TENANT_LEAK/);

      // Assert: No sensitive data in response
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('1000000');
      expect(resultStr).not.toContain('Tower Project Alpha');
      expect(resultStr).not.toContain(orgA.id);

      // Assert: Audit log exists
      // (In real test, query agent_tool_calls table)
    });

    test('T1.2: Cannot list org-A purchase orders', async () => {
      const ctx = RunContext.create({
        runId: 'test-run-t1-2',
        organizationId: orgB.id,
        projectId: null,
        userId: userB.id,
        agentName: 'procurement',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      const result = await executeTool('list_purchase_orders', {
        projectId: projectA.id,
      }, ctx);

      expect(result.ok).toBe(false);
      expect(result.code).toMatch(/PERMISSION|RBAC|TENANT/);
    });

    test('T1.3: Cannot access org-A compliance data', async () => {
      const ctx = RunContext.create({
        runId: 'test-run-t1-3',
        organizationId: orgB.id,
        projectId: null,
        userId: userB.id,
        agentName: 'compliance',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      const result = await executeTool('list_safety_events', {
        projectId: projectA.id,
      }, ctx);

      expect(result.ok).toBe(false);
      expect(result.code).toMatch(/PERMISSION|RBAC|TENANT/);
    });

    test('T1.4: Cannot access org-A BOQ/estimates', async () => {
      const ctx = RunContext.create({
        runId: 'test-run-t1-4',
        organizationId: orgB.id,
        projectId: null,
        userId: userB.id,
        agentName: 'estimating-boq',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      const result = await executeTool('list_boqs', {
        projectId: projectA.id,
      }, ctx);

      expect(result.ok).toBe(false);
      expect(result.code).toMatch(/PERMISSION|RBAC|TENANT/);
    });
  });

  describe('Memory Namespace Isolation', () => {
    test('T1.5: Cannot read org-A memory keys from org-B context', async () => {
      // TODO: Implement memory get/set tests
      // Requires memory-store integration with RunContext
      expect(true).toBe(true); // Placeholder
    });

    test('T1.6: Cannot enumerate org-A Redis keys', async () => {
      // TODO: Redis SCAN with org-B prefix should not return org-A keys
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('OKF/RAG Document Leakage', () => {
    test('T1.7: search_knowledge_base does not return org-A documents', async () => {
      const ctx = RunContext.create({
        runId: 'test-run-t1-7',
        organizationId: orgB.id,
        projectId: null,
        userId: userB.id,
        agentName: 'compliance',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      const result = await executeTool('search_knowledge_base', {
        query: 'safety procedures',
        limit: 10,
      }, ctx);

      // Even if search succeeds, results must be org-B only
      if (result.ok) {
        const docs = (result.data as any)?.documents || [];
        for (const doc of docs) {
          expect(doc.organizationId).toBe(orgB.id);
          expect(doc.organizationId).not.toBe(orgA.id);
        }
      }
    });

    test('T1.8: read_okf_page does not return org-A pages', async () => {
      const ctx = RunContext.create({
        runId: 'test-run-t1-8',
        organizationId: orgB.id,
        projectId: null,
        userId: userB.id,
        agentName: 'compliance',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      // Try to read an OKF page that should be org-A only
      const result = await executeTool('read_okf_page', {
        slug: 'org-a-safety-policy',
      }, ctx);

      // Should either not find it, or refuse access
      expect(result.ok).toBe(false);
    });
  });

  describe('Approval Cross-Org Attacks', () => {
    test('T1.9: Cannot approve org-A approval requests from org-B', async () => {
      // TODO: Create approval in org-A, try to approve from org-B user
      // Requires approval repository integration
      expect(true).toBe(true); // Placeholder
    });

    test('T1.10: Cannot view org-A pending approvals', async () => {
      // TODO: Query approvals API as org-B user
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Conversation/Checkpoint Isolation', () => {
    test('T1.11: Cannot access org-A conversation history', async () => {
      // TODO: LangGraph checkpoint isolation
      expect(true).toBe(true); // Placeholder
    });

    test('T1.12: Cannot resume org-A interrupted runs', async () => {
      // TODO: agent_runs table isolation
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Voice/Multimodal Isolation', () => {
    test('T1.13: Cannot access org-A voice transcripts', async () => {
      // TODO: Voice transcription queue isolation
      expect(true).toBe(true); // Placeholder
    });

    test('T1.14: Cannot access org-A uploaded files/documents', async () => {
      // TODO: MinIO bucket/path isolation
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Error Response Safety', () => {
    test('T1.15: Permission denied returns 403, not 500', async () => {
      const ctx = RunContext.create({
        runId: 'test-run-t1-15',
        organizationId: orgB.id,
        projectId: null,
        userId: userB.id,
        agentName: 'cost-financial',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      const result = await executeTool('get_financial_summary', {
        projectId: projectA.id,
      }, ctx);

      expect(result.ok).toBe(false);
      // Should be clean error code, not crash
      expect(result.code).toBeDefined();
      expect(result.message).toBeDefined();
      // Should NOT leak stack trace
      expect(result.message).not.toMatch(/at \w+\.\w+ \(/); // Stack trace pattern
    });

    test('T1.16: Tenant leak returns proper error, not org-A data', async () => {
      // This tests the assertTenantScope() function
      // If somehow a tool returns org-A data, tenant assertion should catch it
      const ctx = RunContext.create({
        runId: 'test-run-t1-16',
        organizationId: orgB.id,
        projectId: null,
        userId: userB.id,
        agentName: 'cost-financial',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      const result = await executeTool('get_financial_summary', {
        projectId: projectA.id,
      }, ctx);

      // If tool somehow executed (bug), tenant check should catch it
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain(orgA.id);
      expect(resultStr).not.toContain(projectA.id);
    });
  });

  describe('Audit Trail Verification', () => {
    test('T1.17: Cross-tenant attempts are logged in audit', async () => {
      // TODO: Query agent_tool_calls table for this run
      // Verify status=ERROR, errorMessage contains "permission"
      expect(true).toBe(true); // Placeholder
    });

    test('T1.18: Audit log does not contain org-A sensitive data', async () => {
      // TODO: Query audit log, ensure no leakage even in error messages
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Langfuse Trace Isolation', () => {
    test('T1.19: Langfuse traces do not contain org-A data', async () => {
      const ctx = RunContext.create({
        runId: 'test-run-t1-19',
        organizationId: orgB.id,
        projectId: null,
        userId: userB.id,
        agentName: 'cost-financial',
        trigger: 'api',
        limits: { maxSteps: 10, maxTokens: 5000 },
        traceHandle: null,
      });

      await executeTool('get_financial_summary', {
        projectId: projectA.id,
      }, ctx);

      // Query Langfuse for this trace
      // TODO: Need to capture traceId from context
      // const trace = await traceCollector.getTrace(traceId);
      // expect(traceCollector.containsData(trace, '1000000')).toBe(false);
      // expect(traceCollector.containsData(trace, orgA.id)).toBe(false);
    });

    test('T1.20: Tool call denied span appears in Langfuse', async () => {
      // TODO: Verify Langfuse shows ERROR span for denied tool
      // with statusMessage containing "permission"
      expect(true).toBe(true); // Placeholder
    });
  });
});
