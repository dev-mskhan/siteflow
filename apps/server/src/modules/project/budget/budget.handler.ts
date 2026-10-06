import type { FastifyReply, FastifyRequest } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import {
  createProjectBudgetSchema,
  listProjectBudgetsQuerySchema,
  projectBudgetParamsSchema,
  updateProjectBudgetSchema,
  budgetTransitionSchema,
} from '@siteflow/shared';
import { projectBudgetService } from './budget.service.js';

function scope(request: FastifyRequest) {
  const params = projectBudgetParamsSchema.parse(request.params);
  const organizationId = request.orgContext!.organizationId;
  return { organizationId, projectId: params.projectId, budgetId: params.budgetId };
}

export async function handleCreateProjectBudget(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = scope(request);
  const input = createProjectBudgetSchema.parse(request.body);
  const budget = await projectBudgetService.createBudget(
    request.user!.sub,
    organizationId,
    projectId,
    input,
    request.id,
  );
  reply.status(201).send(createSuccessResponse({ budget }));
}

export async function handleListProjectBudgets(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = scope(request);
  listProjectBudgetsQuerySchema.parse(request.query);
  const result = await projectBudgetService.listBudgets(organizationId, projectId);
  reply.send(createSuccessResponse(result));
}

export async function handleGetProjectBudget(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, budgetId } = scope(request);
  const budget = await projectBudgetService.getBudget(organizationId, projectId, budgetId!);
  reply.send(createSuccessResponse({ budget }));
}

export async function handleUpdateProjectBudget(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, budgetId } = scope(request);
  const input = updateProjectBudgetSchema.parse(request.body);
  const budget = await projectBudgetService.updateBudget(
    request.user!.sub,
    organizationId,
    projectId,
    budgetId!,
    input,
    request.id,
  );
  reply.send(createSuccessResponse({ budget }));
}

async function transition(
  request: FastifyRequest,
  action: 'submitBudget' | 'approveBudget' | 'closeBudget',
) {
  const { organizationId, projectId, budgetId } = scope(request);
  const { expectedVersion } = budgetTransitionSchema.parse(request.body);
  return projectBudgetService[action](
    request.user!.sub,
    organizationId,
    projectId,
    budgetId!,
    expectedVersion,
    request.id,
  );
}

export async function handleSubmitProjectBudget(request: FastifyRequest, reply: FastifyReply) {
  const budget = await transition(request, 'submitBudget');
  reply.send(createSuccessResponse({ budget }));
}

export async function handleApproveProjectBudget(request: FastifyRequest, reply: FastifyReply) {
  const budget = await transition(request, 'approveBudget');
  reply.send(createSuccessResponse({ budget }));
}

export async function handleCloseProjectBudget(request: FastifyRequest, reply: FastifyReply) {
  const budget = await transition(request, 'closeBudget');
  reply.send(createSuccessResponse({ budget }));
}

export async function handleProjectBudgetSummary(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, budgetId } = scope(request);
  const summary = await projectBudgetService.getSummary(organizationId, projectId, budgetId!);
  reply.send(createSuccessResponse({ summary }));
}
