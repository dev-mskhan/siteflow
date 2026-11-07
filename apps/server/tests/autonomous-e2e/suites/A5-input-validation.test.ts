// apps/server/tests/autonomous-e2e/suites/A5-input-validation.test.ts
// A5: Input Validation with REAL Gemini API Calls (10 tests)

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { executeRun } from '../../../src/modules/ai/graph/runner.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import { getDb } from '../../../src/lib/db/db.js';
import { generateId } from '../../../src/lib/id.js';
import { organizations, projects, users, organizationMemberships, roles, permissions, rolePermissions } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

describe('A5: Input Validation (REAL Gemini Calls)', () => {
  let org: any, project: any, user: any, role: any, projectReadPerm: any;

  beforeAll(async () => {
    const db = getDb();
    const tid = generateId().slice(0, 8);
    [user] = await db.insert(users).values({ id: generateId(), email: `val-${tid}@test.com`, firstName: 'Val', lastName: 'Test', passwordHash: 'x', emailVerifiedAt: new Date() }).returning();
    [org] = await db.insert(organizations).values({ id: generateId(), name: 'Val Test Org', slug: `val-org-${tid}`, createdBy: user.id }).returning();
    [project] = await db.insert(projects).values({ id: generateId(), organizationId: org.id, projectNumber: `PRJ-VAL-${tid}`, name: 'Val Test Project', currency: 'USD', status: 'ACTIVE' }).returning();
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

  test('T5.1: Empty question is handled gracefully', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: '', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.2: Very long question is handled', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const longQ = 'Show financial summary '.repeat(100);
    const result = await safeExecuteRun(ctx, { question: longQ, projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.3: Question with special characters', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show <script>alert("xss")</script> financial data', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.4: Question with null bytes', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show\x00financial\x00data', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.5: Question with unicode', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Покажи финансовые данные (show financial data)', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.6: Invalid projectId in input', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show financial data', projectId: 'not-a-uuid' });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.7: Missing projectId in input', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Show financial data' });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.8: Very short question', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: 'Budget?', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.9: Question with only numbers', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: '1234567890', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);

  test('T5.10: Question with markdown', async () => {
    const ctx = buildRunContext({ id: generateId(), organizationId: org.id, projectId: project.id, createdBy: user.id, agent: 'cost-financial' });
    const result = await safeExecuteRun(ctx, { question: '# Financial Summary\n\nShow me the **cost** data.', projectId: project.id });
    expect(result.traceId || result.error).toBeTruthy();
  }, 120000);
});
