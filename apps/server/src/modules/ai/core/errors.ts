// apps/server/src/modules/ai/core/errors.ts
// Typed error classes for the AI module.
// All extend AiError so callers can catch narrowly or broadly.

export class AiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  constructor(code: string, message: string, statusCode = 500) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ── Budget ────────────────────────────────────────────────────────────────────

export class BudgetExceededError extends AiError {
  readonly organizationId: string;
  readonly limitUsd: number;
  readonly spentUsd: number;
  constructor(organizationId: string, limitUsd: number, spentUsd: number) {
    super(
      'BUDGET_EXCEEDED',
      `Org ${organizationId} exceeded daily AI budget ($${spentUsd.toFixed(4)} / $${limitUsd.toFixed(4)})`,
    );
    this.name = 'BudgetExceededError';
    this.organizationId = organizationId;
    this.limitUsd = limitUsd;
    this.spentUsd = spentUsd;
  }
}

// ── Run limits ────────────────────────────────────────────────────────────────

export class MaxStepsExceededError extends AiError {
  readonly runId: string;
  constructor(runId: string, maxSteps: number) {
    super('MAX_STEPS_EXCEEDED', `Run ${runId} exceeded max steps (${maxSteps})`);
    this.name = 'MaxStepsExceededError';
    this.runId = runId;
  }
}

export class MaxToolCallsExceededError extends AiError {
  readonly runId: string;
  constructor(runId: string, maxToolCalls: number) {
    super('MAX_TOOL_CALLS_EXCEEDED', `Run ${runId} exceeded max tool calls (${maxToolCalls})`);
    this.name = 'MaxToolCallsExceededError';
    this.runId = runId;
  }
}

export class MaxTokensExceededError extends AiError {
  readonly runId: string;
  constructor(runId: string, maxTokens: number) {
    super('MAX_TOKENS_EXCEEDED', `Run ${runId} exceeded max tokens (${maxTokens})`);
    this.name = 'MaxTokensExceededError';
    this.runId = runId;
  }
}

export class RunTimeoutError extends AiError {
  readonly runId: string;
  constructor(runId: string, timeoutMs: number) {
    super('RUN_TIMEOUT', `Run ${runId} timed out after ${timeoutMs}ms`);
    this.name = 'RunTimeoutError';
    this.runId = runId;
  }
}

export class RunCancelledError extends AiError {
  readonly runId: string;
  constructor(runId: string) {
    super('RUN_CANCELLED', `Run ${runId} was cancelled cooperatively`);
    this.name = 'RunCancelledError';
    this.runId = runId;
  }
}

// ── Guardrail ─────────────────────────────────────────────────────────────────

export class GuardrailBlockedError extends AiError {
  readonly reason: string;
  constructor(reason: string) {
    super('GUARDRAIL_BLOCKED', `Input blocked by guardrail: ${reason}`, 422);
    this.name = 'GuardrailBlockedError';
    this.reason = reason;
  }
}

// ── RBAC ──────────────────────────────────────────────────────────────────────

export class ToolPermissionDeniedError extends AiError {
  readonly toolName: string;
  readonly requiredPermission: string;
  constructor(toolName: string, requiredPermission: string) {
    super(
      'TOOL_PERMISSION_DENIED',
      `Tool "${toolName}" requires permission "${requiredPermission}"`,
    );
    this.name = 'ToolPermissionDeniedError';
    this.toolName = toolName;
    this.requiredPermission = requiredPermission;
  }
}

// ── Approval gate ─────────────────────────────────────────────────────────────

export class ApprovalRequiredError extends AiError {
  readonly toolName: string;
  readonly runId: string;
  readonly statusCode = 400;
  constructor(toolName: string, runId: string) {
    super(
      'APPROVAL_REQUIRED',
      `Tool "${toolName}" is BINDING and requires an approved proposal (run: ${runId})`,
    );
    this.name = 'ApprovalRequiredError';
    this.toolName = toolName;
    this.runId = runId;
  }
}

export class ApprovalRejectedError extends AiError {
  readonly approvalId: string;
  readonly note: string | undefined;
  readonly statusCode = 400;
  constructor(approvalId: string, note?: string) {
    super('APPROVAL_REJECTED', `Approval ${approvalId} was rejected${note ? `: ${note}` : ''}`);
    this.name = 'ApprovalRejectedError';
    this.approvalId = approvalId;
    this.note = note;
  }
}

export class ApprovalExpiredError extends AiError {
  readonly approvalId: string;
  readonly statusCode = 400;
  constructor(approvalId: string) {
    super('APPROVAL_EXPIRED', `Approval ${approvalId} has expired`);
    this.name = 'ApprovalExpiredError';
    this.approvalId = approvalId;
  }
}

export class ApprovalAlreadyDecidedError extends AiError {
  readonly approvalId: string;
  readonly currentStatus: string;
  readonly statusCode = 409;
  constructor(approvalId: string, currentStatus: string) {
    super(
      'APPROVAL_ALREADY_DECIDED',
      `Approval ${approvalId} has already been decided (status: ${currentStatus})`,
    );
    this.name = 'ApprovalAlreadyDecidedError';
    this.approvalId = approvalId;
    this.currentStatus = currentStatus;
  }
}

// ── Tenant isolation ──────────────────────────────────────────────────────────

/** Thrown if a tool ever returns data from outside the run's organizationId */
export class TenantLeakError extends AiError {
  constructor(runId: string, toolName: string) {
    super('TENANT_LEAK', `Tool "${toolName}" in run ${runId} returned out-of-scope data`);
    this.name = 'TenantLeakError';
  }
}

// ── Not found ─────────────────────────────────────────────────────────────────

export class AgentRunNotFoundError extends AiError {
  constructor(runId: string) {
    super('AGENT_RUN_NOT_FOUND', `Agent run "${runId}" not found`);
    this.name = 'AgentRunNotFoundError';
  }
}

export class AgentNotFoundError extends AiError {
  constructor(agentName: string) {
    super('AGENT_NOT_FOUND', `Agent "${agentName}" is not registered`);
    this.name = 'AgentNotFoundError';
  }
}
