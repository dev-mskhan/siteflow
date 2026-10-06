import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveProjectBudget,
  handleCloseProjectBudget,
  handleCreateProjectBudget,
  handleGetProjectBudget,
  handleListProjectBudgets,
  handleProjectBudgetSummary,
  handleSubmitProjectBudget,
  handleUpdateProjectBudget,
} from './budget.handler.js';
import { budgetRouteDocs } from './budget.schemas.js';

const base = '/:organizationId/projects/:projectId/budgets';

export const projectBudgetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(base, {
    schema: budgetRouteDocs.create,
    preHandler: [requireProjectPermission('project.budget.create')],
  }, handleCreateProjectBudget);
  fastify.get(base, {
    schema: budgetRouteDocs.list,
    preHandler: [requireProjectPermission('project.budget.read')],
  }, handleListProjectBudgets);
  fastify.get(`${base}/:budgetId`, {
    schema: budgetRouteDocs.get,
    preHandler: [requireProjectPermission('project.budget.read')],
  }, handleGetProjectBudget);
  fastify.patch(`${base}/:budgetId`, {
    schema: budgetRouteDocs.update,
    preHandler: [requireProjectPermission('project.budget.update')],
  }, handleUpdateProjectBudget);
  fastify.post(`${base}/:budgetId/submit`, {
    schema: budgetRouteDocs.transition,
    preHandler: [requireProjectPermission('project.budget.submit')],
  }, handleSubmitProjectBudget);
  fastify.post(`${base}/:budgetId/approve`, {
    schema: budgetRouteDocs.transition,
    preHandler: [requireProjectPermission('project.budget.approve')],
  }, handleApproveProjectBudget);
  fastify.post(`${base}/:budgetId/close`, {
    schema: budgetRouteDocs.transition,
    preHandler: [requireProjectPermission('project.budget.close')],
  }, handleCloseProjectBudget);
  fastify.get(`${base}/:budgetId/summary`, {
    schema: budgetRouteDocs.summary,
    preHandler: [requireProjectPermission('project.budget.read')],
  }, handleProjectBudgetSummary);
};
