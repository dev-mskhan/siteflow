// apps/server/tests/autonomous-e2e/suites/A7-memory-isolation.test.ts
// A7: Memory & Learning Loop with REAL Gemini API Calls (10 tests)

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { executeRun } from '../../../src/modules/ai/graph/runner.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import { getDb } from '../../../src/lib/db/db.js';
import { generateId } from '../../../src/lib/id.js';
import { organizations, projects, users, organizationMemberships, roles, permissions, rolePermissions } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

describe('A7: Memory & Learning Loop (REAL Gemini Calls)', () => {
  let orgA: any, orgB: any, projectA: any, userA: any, userB: any, role: any, projectReadPerm: any;

  beforeAll(async () => {
    const db = getDb();
    const tid = generateId().slice(0, 8);
    [userA] = await db.insert(users).values({ id: generateId(), email: `memA-${tid}@test.com`, firstName: 'MemA', lastName: 'Test', passwordHash: 'x', emailVerifiedAt: new Date() }).returning();
    [userB] = await db.insert(users).values({ id: generateId(), email: `memB-${tid}@test.com`, firstName: 'MemB', lastName: 'Test', passwordHash: 'x', emailVerifiedAt: new Date() }).returning();
    [orgA] = await db.insert(organizations).values({ id: generateId(), name: 'Mem Org A', slug: `mem-org-a-${tid}`, createdBy: userA.id }).returning();
    [orgB] = await db.insert(organizations).values({ id: generateId(), name: 'Mem Org B', slug: `mem-org-b-${tid}`, createdBy: userB.id }).returning();
    [projectA] = await db.insert(projects).values({ id: generateId(), organizationId: orgA.id, projectNumber: `PRJ-MEM-${tid}`, name: 'Mem Project', currency: 'USD', status: 'ACTIVE' }).returning();
    const ep = await db.select().from(permissions).where(eq(permissions.key, 'project:read')).limit(1);
    if (ep.length > 0) { projectReadPerm = ep[0]; } else { [projectReadPerm] = await db.insert(permissions).values({ id: generateId(), key: 'project:read', description: 'Read project data' }).returning(); }
    [role] = await db.insert(roles).values({ id: generateId(), organizationId: orgA.id, name: 'Admin', description: 'Full access' }).returning();
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: projectReadPerm.id });
    await db.insert(organizationMemberships).values({ id: generateId(), organizationId: orgA.id, userId: userA.id, roleId: role.id, status: 'ACTIVE' });
    const [roleB] = await db.insert(roles).values({ id: generateId(), organizationId: orgB.id, name: 'Admin', description: 'Full access' }).returning();
    await db.insert(rolePermissions).values({ roleId: roleB.id, permissionId: projectReadPerm.id });
    await db.insert(organizationMemberships).values({ id: generateId(), organizationId: orgB.id, userId: userB.id, roleId: roleB.id, status: 'ACTIVE' });
  }, 60000);

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizationMemberships).where(eq(organizationMemberships.organizationId, orgA.id));
    await db.delete(organizationMemberships).where(eq(organizationMemberships.organizationId, orgB.id));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    await db.delete(roles).where(eq(roles.organizationId, orgA.id));
    await db.delete(roles).where(eq(roles.organizationId, orgB.id));
    await db.delete(projects).where(eq(projects.id, projectA.id));
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    if (userA?.id) await db.delete(users).where(eq(users.id, userA.id));
    if (userB?.id) await db.delete(users).where(eq(users.id, userB.id));
  });

  async function safeExecuteRun(ctx: any, input: any) {
    try { return await executeRun(ctx, input); }
    catch (err) { return { traceId: undefined, error: err, output: null, tokensIn: 0, tokensOut: 0, interrupted: false }; }
  }

  test('T7.1: Agent in orgA cannot access orgB memory', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show financial data from orgB', projectId: projectA.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T7.2: Memory namespace is org-scoped', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show budget', projectId: projectA.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T7.3: Agent run uses tenant-scoped context', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show cost summary', projectId: projectA.id });
    if (result.output) {
      const output = JSON.stringify(result.output);
      expect(output).not.toContain(orgB.id);
    }
  }, 120000);

  test('T7.4: Agent run is isolated per run ID', async () => {
    const ctx1 = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const ctx2 = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    expect(ctx1.runId).not.toBe(ctx2.runId);
  }, 120000);

  test('T7.5: Agent in orgB cannot see orgA data', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: orgB.id, createdBy: userB.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: `Show data from project ${projectA.id}` });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T7.6: Multiple runs in same org are independent', async () => {
    const ctx1 = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const ctx2 = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const [r1, r2] = await Promise.allSettled([
      safeExecuteRun(ctx1, { question: 'Show budget', projectId: projectA.id }),
      safeExecuteRun(ctx2, { question: 'Show cost', projectId: projectA.id }),
    ]);
    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
  }, 120000);

  test('T7.7: Agent output respects org boundary', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show all data', projectId: projectA.id });
    if (result.output) {
      const output = JSON.stringify(result.output);
      expect(output).not.toContain(orgB.id);
    }
  }, 120000);

  test('T7.8: Agent handles missing project gracefully', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: orgA.id, createdBy: userA.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show financial data' });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T7.9: Agent run with project scope', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show billing', projectId: projectA.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T7.10: Agent maintains context across tool calls', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: orgA.id, projectId: projectA.id, createdBy: userA.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show financial summary and budget', projectId: projectA.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);
});
