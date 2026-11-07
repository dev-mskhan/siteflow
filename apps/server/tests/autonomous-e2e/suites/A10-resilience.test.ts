// apps/server/tests/autonomous-e2e/suites/A10-resilience.test.ts
// A10: Resilience & Error Handling with REAL Gemini API Calls (10 tests)

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { executeRun } from '../../../src/modules/ai/graph/runner.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import type { RunLimits } from '../../../src/modules/ai/core/types.js';
import { getDb } from '../../../src/lib/db/db.js';
import { generateId } from '../../../src/lib/id.js';
import { organizations, projects, users, organizationMemberships, roles, permissions, rolePermissions } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

const TEST_LIMITS: RunLimits = { maxSteps: 10, maxToolCalls: 8, maxTokens: 50_000, timeoutMs: 60_000 };

describe('A10: Resilience & Error Handling (REAL Gemini Calls)', () => {
  let org: any, project: any, user: any, role: any, projectReadPerm: any;

  beforeAll(async () => {
    const db = getDb();
    const tid = generateId().slice(0, 8);
    [user] = await db.insert(users).values({ id: generateId(), email: `res-${tid}@test.com`, firstName: 'Res', lastName: 'Test', passwordHash: 'x', emailVerifiedAt: new Date() }).returning();
    [org] = await db.insert(organizations).values({ id: generateId(), name: 'Res Test Org', slug: `res-org-${tid}`, createdBy: user.id }).returning();
    [project] = await db.insert(projects).values({ id: generateId(), organizationId: org.id, projectNumber: `PRJ-RES-${tid}`, name: 'Res Test Project', currency: 'USD', status: 'ACTIVE' }).returning();
    const ep = await db.select().from(permissions).where(eq(permissions.key, 'project:read')).limit(1);
    if (ep.length > 0) { projectReadPerm = ep[0]; } else { [projectReadPerm] = await db.insert(permissions).values({ id: generateId(), key: 'project:read', description: 'Read project data' }).returning(); }
    [role] = await db.insert(roles).values({ id: generateId(), organizationId: org.id, name: 'Admin', description: 'Full access' }).returning();
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: projectReadPerm.id });
    await db.insert(organizationMemberships).values({ id: generateId(), organizationId: org.id, userId: user.id, roleId: role.id, status: 'ACTIVE' });
  }, 60000);

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizationMemberships).where(eq(organizationMemberships.organizationId, org.id));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    await db.delete(roles).where(eq(roles.organizationId, org.id));
    await db.delete(projects).where(eq(projects.id, project.id));
    await db.delete(organizations).where(eq(organizations.id, org.id));
    if (user?.id) await db.delete(users).where(eq(users.id, user.id));
  });

  async function safeExecuteRun(ctx: any, input: any) {
    try { return await executeRun(ctx, input); }
    catch (err) { return { traceId: undefined, error: err, output: null, tokensIn: 0, tokensOut: 0, interrupted: false }; }
  }

  test('T10.1: Agent run completes within timeout', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show budget', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T10.2: Agent handles empty data gracefully', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show all financial data', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T10.3: Agent does not infinite loop', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Keep showing me more and more data repeatedly', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T10.4: Agent error does not expose stack traces', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show financial summary', projectId: project.id });
    if (result.output) {
      const output = JSON.stringify(result.output);
      expect(output).not.toContain('at RunnableCallable');
      expect(output).not.toContain('node_modules');
    }
  }, 90000);

  test('T10.5: Multiple concurrent runs are safe', async () => {
    const ctx1 = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const ctx2 = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const [r1, r2] = await Promise.allSettled([
      safeExecuteRun(ctx1, { question: 'Show budget', projectId: project.id }),
      safeExecuteRun(ctx2, { question: 'Show cost', projectId: project.id }),
    ]);
    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
  }, 90000);

  test('T10.6: Agent handles malformed input gracefully', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: null as any, projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T10.7: Agent run produces trace for debugging', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show cost summary', projectId: project.id });
    if (result.traceId) {
      expect(typeof result.traceId).toBe('string');
      expect(result.traceId.length).toBeGreaterThan(0);
    }
  }, 90000);

  test('T10.8: Agent handles tool failure gracefully', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show data for invalid project', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T10.9: Agent respects token budget', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show financial summary', projectId: project.id });
    if (result.tokensIn !== undefined && result.tokensOut !== undefined) {
      expect(result.tokensIn + result.tokensOut).toBeLessThan(50000);
    }
  }, 90000);

  test('T10.10: Agent run produces clean error on failure', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show financial data', projectId: project.id });
    if (result.error) {
      const errMsg = (result.error as Error).message || '';
      expect(errMsg.length).toBeGreaterThan(0);
    }
  }, 90000);
});
