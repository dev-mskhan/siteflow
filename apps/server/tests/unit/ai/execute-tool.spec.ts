// apps/server/tests/unit/ai/execute-tool.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import '../../../src/modules/ai/index.js';
import { executeTool } from '../../../src/modules/ai/tools/tool-factory.js';
import { registerTool } from '../../../src/modules/ai/tools/tool-registry.js';
import { buildRunContext } from '../../../src/modules/ai/core/run-context.js';
import { getTestSql, closeTestSql } from '../../helpers/ai/ai-fixtures.js';

describe('AI Layer Tool Execution Safety Envelope (executeTool)', () => {
  const sql = getTestSql();
  const testOrgId = `org_${crypto.randomUUID().slice(0, 8)}`;
  const testUserId = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const testRunId = `run_${crypto.randomUUID().slice(0, 8)}`;

  const ctx = buildRunContext({
    id: testRunId,
    organizationId: testOrgId,
    agent: 'echo',
    createdBy: testUserId,
  });

  beforeAll(async () => {
    // Insert prerequisite organization and user records in test DB
    await sql`
      INSERT INTO "app"."users" ("id", "email", "password_hash", "first_name", "status")
      VALUES (${testUserId}, ${`user_${testUserId}@test.dev`}, 'hash', 'Test', 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `;
    await sql`
      INSERT INTO "app"."organizations" ("id", "name", "slug", "created_by", "status")
      VALUES (${testOrgId}, 'Tool Execution Test Org', ${`slug-${testOrgId}`}, ${testUserId}, 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `;
    await sql`
      INSERT INTO "app"."agent_runs" (
        "id", "organization_id", "agent", "trigger", "status", "created_by"
      ) VALUES (
        ${testRunId}, ${testOrgId}, 'echo', 'USER', 'RUNNING', ${testUserId}
      )
      ON CONFLICT DO NOTHING;
    `;

    // Register a tenant-leaking test tool
    registerTool({
      name: 'fake_leaking_tool',
      description: 'Returns data belonging to a different tenant',
      argsSchema: z.object({ target: z.string().default('any') }),
      riskTier: 'READ',
      requiredPermission: '',
      async execute() {
        return { organizationId: 'foreign-org-999', secretData: 'should_not_leak' };
      },
    });

    // Register a sensitive args test tool
    registerTool({
      name: 'fake_sensitive_tool',
      description: 'Tool that takes PII and secret arguments',
      argsSchema: z.object({
        email: z.string().email(),
        apiKey: z.string(),
        normalField: z.string(),
      }),
      riskTier: 'READ',
      requiredPermission: '',
      async execute(args) {
        return { ok: true, normalField: args.normalField };
      },
    });
  });

  afterAll(async () => {
    await closeTestSql();
  });

  it('successfully executes READ tool fake_read_loop and logs SUCCESS', async () => {
    const result = await executeTool<{ iteration: number; timestamp: number }>(
      'fake_read_loop',
      { iteration: 7 },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.iteration).toBe(7);
      expect(typeof result.data.timestamp).toBe('number');
    }

    const toolCalls = await sql`
      SELECT * FROM "app"."agent_tool_calls"
      WHERE run_id = ${testRunId} AND tool_name = 'fake_read_loop'
      ORDER BY created_at DESC LIMIT 1;
    `;
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].status).toBe('SUCCESS');
    expect(toolCalls[0].duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('successfully executes fake_sleep and tracks non-zero duration', async () => {
    const result = await executeTool<{ sleptMs: number }>(
      'fake_sleep',
      { durationMs: 25 },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sleptMs).toBe(25);
    }

    const toolCalls = await sql`
      SELECT duration_ms, status FROM "app"."agent_tool_calls"
      WHERE run_id = ${testRunId} AND tool_name = 'fake_sleep'
      ORDER BY created_at DESC LIMIT 1;
    `;
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].status).toBe('SUCCESS');
    expect(toolCalls[0].duration_ms).toBeGreaterThanOrEqual(15);
  });

  it('returns TOOL_NOT_FOUND when tool name is unregistered', async () => {
    const result = await executeTool('non_existent_tool_xyz', {}, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TOOL_NOT_FOUND');
      expect(result.message).toContain('is not registered');
    }

    const toolCalls = await sql`
      SELECT status, error_message FROM "app"."agent_tool_calls"
      WHERE run_id = ${testRunId} AND tool_name = 'non_existent_tool_xyz'
      ORDER BY created_at DESC LIMIT 1;
    `;
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].status).toBe('ERROR');
  });

  it('returns INVALID_ARGS when arguments violate Zod schema', async () => {
    const result = await executeTool(
      'fake_read_loop',
      { iteration: 'invalid-string-not-number' },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_ARGS');
    }

    const toolCalls = await sql`
      SELECT status, error_message FROM "app"."agent_tool_calls"
      WHERE run_id = ${testRunId} AND tool_name = 'fake_read_loop' AND status = 'ERROR'
      ORDER BY created_at DESC LIMIT 1;
    `;
    expect(toolCalls.length).toBeGreaterThan(0);
  });

  it('blocks BINDING tool fake_approve_something with APPROVAL_REQUIRED when unapproved', async () => {
    const result = await executeTool(
      'fake_approve_something',
      { amount: 1500, action: 'order_parts' },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('APPROVAL_REQUIRED');
    }

    const toolCalls = await sql`
      SELECT status, error_message FROM "app"."agent_tool_calls"
      WHERE run_id = ${testRunId} AND tool_name = 'fake_approve_something'
      ORDER BY created_at DESC LIMIT 1;
    `;
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].status).toBe('SKIPPED');
  });

  it('catches tenant leaks and returns TENANT_LEAK without returning data', async () => {
    const result = await executeTool('fake_leaking_tool', { target: 'all' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TENANT_LEAK');
    }

    const toolCalls = await sql`
      SELECT status, error_message FROM "app"."agent_tool_calls"
      WHERE run_id = ${testRunId} AND tool_name = 'fake_leaking_tool'
      ORDER BY created_at DESC LIMIT 1;
    `;
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].status).toBe('ERROR');
  });

  it('redacts sensitive fields (apiKey, email) in logged tool arguments', async () => {
    const result = await executeTool(
      'fake_sensitive_tool',
      {
        email: 'contractor@example.com',
        apiKey: 'sk-secret-key-123456',
        normalField: 'concrete-batch-5',
      },
      ctx,
    );

    expect(result.ok).toBe(true);

    const toolCalls = await sql`
      SELECT args_redacted FROM "app"."agent_tool_calls"
      WHERE run_id = ${testRunId} AND tool_name = 'fake_sensitive_tool'
      ORDER BY created_at DESC LIMIT 1;
    `;
    expect(toolCalls.length).toBe(1);
    const argsRedacted = toolCalls[0].args_redacted as Record<string, string>;
    expect(argsRedacted.apiKey).toBe('[REDACTED]');
    expect(argsRedacted.email).toBe('[REDACTED]');
    expect(argsRedacted.normalField).toBe('concrete-batch-5');
  });
});
