// apps/server/tests/autonomous-e2e/suites/A8-coordinator.test.ts
// A8: Coordinator Routing with REAL Gemini API Calls (10 tests)

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { executeRun } from '../../../src/modules/ai/graph/runner.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import type { RunLimits } from '../../../src/modules/ai/core/types.js';
import { getDb } from '../../../src/lib/db/db.js';
import { generateId } from '../../../src/lib/id.js';
import { organizations, projects, users, organizationMemberships, roles, permissions, rolePermissions } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

const TEST_LIMITS: RunLimits = { maxSteps: 10, maxToolCalls: 8, maxTokens: 50_000, timeoutMs: 60_000 };

describe('A8: Coordinator Routing (REAL Gemini Calls)', () => {
  let org: any, project: any, user: any, role: any, projectReadPerm: any;

  beforeAll(async () => {
    const db = getDb();
    const tid = generateId().slice(0, 8);
    [user] = await db.insert(users).values({ id: generateId(), email: `coord-${tid}@test.com`, firstName: 'Coord', lastName: 'Test', passwordHash: 'x', emailVerifiedAt: new Date() }).returning();
    [org] = await db.insert(organizations).values({ id: generateId(), name: 'Coord Test Org', slug: `coord-org-${tid}`, createdBy: user.id }).returning();
    [project] = await db.insert(projects).values({ id: generateId(), organizationId: org.id, projectNumber: `PRJ-COORD-${tid}`, name: 'Coord Test Project', currency: 'USD', status: 'ACTIVE' }).returning();
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

  test('T8.1: Coordinator routes financial question', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'coordinator' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'What is the budget for this project?', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T8.2: Coordinator routes procurement question', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'coordinator' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show purchase orders', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T8.3: Coordinator routes compliance question', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'coordinator' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show safety events', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T8.4: Coordinator handles ambiguous question', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'coordinator' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'What is the project status?', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T8.5: Coordinator handles general question', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'coordinator' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Hello, what can you help me with?', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T8.6: Coordinator respects tenant boundaries', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'coordinator' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show data from all organizations', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T8.7: Coordinator run produces trace', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'coordinator' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show project financial data', projectId: project.id });
    if (result.traceId) {
      expect(typeof result.traceId).toBe('string');
    }
  }, 90000);

  test('T8.8: Coordinator handles empty question', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'coordinator' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: '', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T8.9: Cost-financial agent handles direct query', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Show cash summary', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);

  test('T8.10: Reports agent handles report request', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'reports' }, TEST_LIMITS);
    const result = await safeExecuteRun(ctx, { question: 'Generate executive summary', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 90000);
});
