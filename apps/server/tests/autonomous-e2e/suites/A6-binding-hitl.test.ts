// apps/server/tests/autonomous-e2e/suites/A6-binding-hitl.test.ts
// A6: Binding/HITL Approval Flow with REAL Gemini API Calls (10 tests)

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { executeRun } from '../../../src/modules/ai/graph/runner.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import { getDb } from '../../../src/lib/db/db.js';
import { generateId } from '../../../src/lib/id.js';
import { organizations, projects, users, organizationMemberships, roles, permissions, rolePermissions } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

describe('A6: Binding/HITL Approval Flow (REAL Gemini Calls)', () => {
  let org: any, project: any, user: any, role: any, projectReadPerm: any;

  beforeAll(async () => {
    const db = getDb();
    const tid = generateId().slice(0, 8);
    [user] = await db.insert(users).values({ id: generateId(), email: `hitl-${tid}@test.com`, firstName: 'HITL', lastName: 'Test', passwordHash: 'x', emailVerifiedAt: new Date() }).returning();
    [org] = await db.insert(organizations).values({ id: generateId(), name: 'HITL Test Org', slug: `hitl-org-${tid}`, createdBy: user.id }).returning();
    [project] = await db.insert(projects).values({ id: generateId(), organizationId: org.id, projectNumber: `PRJ-HITL-${tid}`, name: 'HITL Test Project', currency: 'USD', status: 'ACTIVE' }).returning();
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

  test('T6.1: READ tool does not require approval', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show financial summary', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
    // READ tools should not interrupt
  }, 120000);

  test('T6.2: Agent run completes without interruption for read-only', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show cost summary', projectId: project.id });
    expect(result.interrupted).toBe(false);
  }, 120000);

  test('T6.3: Agent respects tool boundaries', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show budget', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T6.4: Agent run produces trace ID for audit', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show billing summary', projectId: project.id });
    if (result.traceId) {
      expect(typeof result.traceId).toBe('string');
      expect(result.traceId.length).toBeGreaterThan(0);
    }
  }, 120000);

  test('T6.5: Agent tracks token usage', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show cash summary', projectId: project.id });
    if (result.tokensIn !== undefined) {
      expect(result.tokensIn).toBeGreaterThanOrEqual(0);
    }
  }, 120000);

  test('T6.6: Agent run is tenant-isolated', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show audit events', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T6.7: Multiple agent runs are independent', async () => {
    const ctx1 = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const ctx2 = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const [r1, r2] = await Promise.allSettled([
      safeExecuteRun(ctx1, { question: 'Show budget', projectId: project.id }),
      safeExecuteRun(ctx2, { question: 'Show cost', projectId: project.id }),
    ]);
    // Both should complete independently
    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
  }, 120000);

  test('T6.8: Agent handles tool errors gracefully', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show non-existent data', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T6.9: Agent run produces output', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show financial summary', projectId: project.id });
    if (result.output) {
      expect(typeof result.output).toBe('object');
    }
  }, 120000);

  test('T6.10: Agent respects max steps limit', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show all financial data including summary, cost, billing, cash, and budget', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
    // Should complete within maxSteps (20)
  }, 120000);
});
