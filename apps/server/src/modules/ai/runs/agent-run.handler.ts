// apps/server/src/modules/ai/runs/agent-run.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AgentRunService } from './agent-run.service.js';
import { createSuccessResponse } from '../../../shared/response.js';
import type { AgentName, AgentRunStatus } from '../core/types.js';
import { getAgent } from '../core/agent-registry.js';

const runService = new AgentRunService();

// ── Zod schemas (inline — no shared package dep for now) ─────────────────────

const startRunBodySchema = z.object({
  agent: z.string(),
  projectId: z.string().uuid().optional(),
  input: z.record(z.unknown()).default({}),
});

const runIdParamSchema = z.object({
  organizationId: z.string().uuid(),
  runId: z.string().uuid(),
});

const listRunsQuerySchema = z.object({
  agent: z.string().optional(),
  projectId: z.string().uuid().optional(),
  status: z
    .enum(['QUEUED', 'RUNNING', 'AWAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/organizations/:organizationId/ai/runs
 * Validates input, enqueues a new agent run, returns runId immediately.
 * Requires: ai.runs.create permission
 */
export async function handleStartRun(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId } = request.params as { organizationId: string };
  const body = startRunBodySchema.parse(request.body);
  const userId = request.user!.sub;

  const manifest = getAgent(body.agent);
  if (!manifest) {
    return reply.status(400).send({ error: `Unknown agent: ${body.agent}` });
  }
  if (!manifest.supportedChannels.includes('api')) {
    return reply.status(400).send({ error: `Agent "${body.agent}" does not support API channel` });
  }
  const inputValidation = manifest.inputSchema.safeParse(body.input);
  if (!inputValidation.success) {
    return reply.status(422).send({ error: inputValidation.error.format() });
  }

  const { runId } = await runService.startRun({
    organizationId,
    agent: body.agent as AgentName,
    projectId: body.projectId,
    input: body.input,
    createdBy: userId,
    trigger: 'USER',
  });

  return reply.status(202).send(
    createSuccessResponse({ runId, status: 'QUEUED' }),
  );
}

/**
 * GET /api/v1/organizations/:organizationId/ai/runs/:runId
 * Returns the full agent_runs row for the given org+runId.
 * Requires: ai.runs.read permission
 */
export async function handleGetRun(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, runId } = runIdParamSchema.parse(request.params);
  const run = await runService.getRun(runId, organizationId);
  return reply.send(createSuccessResponse({ run }));
}

/**
 * GET /api/v1/organizations/:organizationId/ai/runs
 * Paginated list of runs for the org, with optional filters.
 * Requires: ai.runs.read permission
 */
export async function handleListRuns(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId } = request.params as { organizationId: string };
  const query = listRunsQuerySchema.parse(request.query);

  const { data, nextCursor } = await runService.listRuns({
    organizationId,
    agent: query.agent,
    projectId: query.projectId,
    status: query.status as AgentRunStatus | undefined,
    limit: query.limit,
    cursor: query.cursor,
  });

  return reply.send(
    createSuccessResponse({ runs: data, nextCursor }),
  );
}

/**
 * DELETE /api/v1/organizations/:organizationId/ai/runs/:runId
 * Cancels a QUEUED or AWAITING_APPROVAL run.
 * Requires: ai.runs.cancel permission
 */
export async function handleCancelRun(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, runId } = runIdParamSchema.parse(request.params);
  await runService.cancelRun(runId, organizationId);
  return reply.send(createSuccessResponse({ message: 'Run cancelled' }));
}
