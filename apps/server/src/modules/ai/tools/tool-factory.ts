// apps/server/src/modules/ai/tools/tool-factory.ts
//
// Wraps every tool execution with:
//   1. Registry lookup — throws if the tool is unknown
//   2. RBAC check — resolves user's org permissions, throws ToolPermissionDeniedError
//   3. Tier gate — BINDING tools require an APPROVED agent_approvals row that was
//      created for this exact tool name + argument hash (exact-action binding)
//   4. Tenant assertion — result is checked for cross-org data leaks
//   5. Audit log — every call (success or error) written to agent_tool_calls
//   6. ToolResult envelope — typed ok/error return, never throws to the graph
//
// The graph calls executeTool(). It never calls getTool() or the execute() fn directly.

import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { createHash } from 'node:crypto';
import { rbacService } from '../../rbac/rbac.service.js';
import { getTool } from './tool-registry.js';
import { ToolCallRepository } from './tool-call.repository.js';
import type { RunContext } from '../core/run-context.js';
import { assertTenantScope } from '../core/run-context.js';
import {
  ApprovalRequiredError,
} from '../core/errors.js';
import type { ToolResult } from '../core/types.js';

const tracer = trace.getTracer('ai-tool-factory');
const toolCallRepo = new ToolCallRepository();

// ── Approval gate ─────────────────────────────────────────────────────────────
// BINDING tools require an APPROVED agent_approvals row for the current run.
// The approval is bound to the exact tool name and argument hash that triggered
// the interrupt — prevents approval for action A from authorising action B.

import { ApprovalRepository } from '../approvals/approval.repository.js';
const approvalRepo = new ApprovalRepository();

async function checkApprovalGate(
  ctx: RunContext,
  toolName: string,
  parsedArgs: unknown,
): Promise<void> {
  // Use findLatestForRun (not findPendingForRun): on resume the row is already APPROVED,
  // so a PENDING-only query returns undefined and silently drops the resume (ARC-02).
  const approval = await approvalRepo.findLatestForRun(ctx.runId);
  if (!approval || approval.status !== 'APPROVED') {
    throw new ApprovalRequiredError(toolName, ctx.runId);
  }

  // Exact-action binding: verify the approval was issued for this specific tool + args.
  // approvedToolName / approvedArgsHash are null on rows created before this fix,
  // so we skip the check when they are absent (backward-compatible).
  if (approval.approvedToolName && approval.approvedToolName !== toolName) {
    throw new ApprovalRequiredError(toolName, ctx.runId);
  }

  if (approval.approvedArgsHash) {
    const sortedArgs = JSON.stringify(
      parsedArgs,
      parsedArgs && typeof parsedArgs === 'object'
        ? Object.keys(parsedArgs as Record<string, unknown>).sort()
        : undefined,
    );
    const argsHash = createHash('sha256').update(sortedArgs).digest('hex');
    if (approval.approvedArgsHash !== argsHash) {
      throw new ApprovalRequiredError(toolName, ctx.runId);
    }
  }
}

// ── Redact args before storage ────────────────────────────────────────────────
// Strip any key that looks like it could contain PII or secrets.
// This is a conservative best-effort pass; tools that need more specific
// redaction should override via a `redactArgs` fn in their definition.

const REDACT_KEYS = new Set([
  'password', 'token', 'secret', 'key', 'apiKey', 'api_key',
  'ssn', 'dob', 'dateOfBirth', 'phone', 'email',
]);

function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([k, v]) => [
      k,
      REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v,
    ]),
  );
}

// ── Result summary (compact, safe for DB storage) ────────────────────────────

function summariseResult(result: unknown): Record<string, unknown> {
  if (result === null || result === undefined) return { empty: true };
  if (typeof result !== 'object') return { scalar: String(result).slice(0, 200) };

  const entries = Object.entries(result as Record<string, unknown>);
  // Keep only top-level keys + their types (no values) to avoid storing data blobs
  return {
    keys: entries.map(([k]) => k),
    count: entries.length,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Execute a registered tool within the safety envelope.
 *
 * @param toolName  - Name of the tool as it appears in the registry
 * @param rawArgs   - Arguments from the LLM (will be Zod-parsed inside)
 * @param ctx       - Frozen RunContext — never modified
 * @returns         - ToolResult<T>: ok=true with data, or ok=false with error code
 */
export async function executeTool<T = unknown>(
  toolName: string,
  rawArgs: unknown,
  ctx: RunContext,
): Promise<ToolResult<T>> {
  return withSpan(tracer, `ai.tool.${toolName}`, async (span) => {
    span.setAttribute('ai.tool.name', toolName);
    span.setAttribute('ai.run.id', ctx.runId);
    span.setAttribute('organization.id', ctx.organizationId);

    const startMs = Date.now();

    // ── 1. Registry lookup ──────────────────────────────────────────────────
    const tool = getTool(toolName);
    if (!tool) {
      await toolCallRepo.log({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        toolName,
        riskTier: 'READ',
        argsRedacted: {},
        status: 'ERROR',
        errorMessage: `Tool "${toolName}" is not registered`,
        durationMs: Date.now() - startMs,
      });
      return { ok: false, code: 'TOOL_NOT_FOUND', message: `Tool "${toolName}" is not registered` };
    }

    span.setAttribute('ai.tool.risk_tier', tool.riskTier);

    // ── 2. Parse args (Zod) ─────────────────────────────────────────────────
    const parseResult = tool.argsSchema.safeParse(rawArgs);
    if (!parseResult.success) {
      const message = parseResult.error.issues.map((i) => i.message).join('; ');
      await toolCallRepo.log({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        toolName,
        riskTier: tool.riskTier,
        argsRedacted: redactArgs((rawArgs as Record<string, unknown>) ?? {}),
        status: 'ERROR',
        errorMessage: `Invalid args: ${message}`,
        durationMs: Date.now() - startMs,
      });
      return { ok: false, code: 'INVALID_ARGS', message };
    }

    const parsedArgs = parseResult.data;
    const argsRedacted = redactArgs(parsedArgs as Record<string, unknown>);

    // ── 3. RBAC check ───────────────────────────────────────────────────────
    // We resolve the org context fresh (cache-backed) on every call.
    // RunContext carries userId + organizationId from the DB row — never LLM input.
    let orgCtx: Awaited<ReturnType<typeof rbacService.getOrganizationContext>>;
    try {
      orgCtx = await rbacService.getOrganizationContext(ctx.organizationId, ctx.userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'RBAC lookup failed';
      await toolCallRepo.log({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        toolName,
        riskTier: tool.riskTier,
        argsRedacted,
        status: 'ERROR',
        errorMessage: message,
        durationMs: Date.now() - startMs,
      });
      return { ok: false, code: 'RBAC_ERROR', message };
    }

    if (!rbacService.hasPermission(orgCtx, tool.requiredPermission)) {
      const msg = `Missing permission "${tool.requiredPermission}" for tool "${toolName}"`;
      await toolCallRepo.log({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        toolName,
        riskTier: tool.riskTier,
        argsRedacted,
        status: 'ERROR',
        errorMessage: msg,
        durationMs: Date.now() - startMs,
      });
      return {
        ok: false,
        code: 'TOOL_PERMISSION_DENIED',
        message: msg,
      };
    }

    // ── 4. Tier gate ────────────────────────────────────────────────────────
    if (tool.riskTier === 'BINDING') {
      try {
        await checkApprovalGate(ctx, toolName, parsedArgs);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Approval required';
        await toolCallRepo.log({
          runId: ctx.runId,
          organizationId: ctx.organizationId,
          toolName,
          riskTier: tool.riskTier,
          argsRedacted,
          status: 'SKIPPED',
          errorMessage: message,
          durationMs: Date.now() - startMs,
        });
        return { ok: false, code: 'APPROVAL_REQUIRED', message };
      }
    }

    // ── 5. Execute ──────────────────────────────────────────────────────────
    let result: T;
    try {
      result = await tool.execute(parsedArgs, ctx) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tool execution error';
      await toolCallRepo.log({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        toolName,
        riskTier: tool.riskTier,
        argsRedacted,
        status: 'ERROR',
        errorMessage: message,
        durationMs: Date.now() - startMs,
      });
      return { ok: false, code: 'TOOL_EXECUTION_ERROR', message };
    }

    // ── 6. Tenant assertion ─────────────────────────────────────────────────
    // If the result is an object with organizationId, it must match the RunContext.
    // assertTenantScope throws TenantLeakError on mismatch — we catch and surface it.
    try {
      assertTenantScope(ctx, result as { organizationId?: string | null }, toolName);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tenant scope violation';
      await toolCallRepo.log({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        toolName,
        riskTier: tool.riskTier,
        argsRedacted,
        status: 'ERROR',
        errorMessage: message,
        durationMs: Date.now() - startMs,
      });
      return { ok: false, code: 'TENANT_LEAK', message };
    }

    // ── 7. Success log ──────────────────────────────────────────────────────
    await toolCallRepo.log({
      runId: ctx.runId,
      organizationId: ctx.organizationId,
      toolName,
      riskTier: tool.riskTier,
      argsRedacted,
      status: 'SUCCESS',
      resultSummary: summariseResult(result),
      durationMs: Date.now() - startMs,
    });

    return { ok: true, data: result };
  });
}
