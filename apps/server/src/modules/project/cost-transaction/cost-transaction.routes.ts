import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleCreateCostTransaction,
  handleGetCostTransaction,
  handleListCostTransactions,
  handlePostCostTransaction,
  handleVoidCostTransaction,
} from './cost-transaction.handler.js';
import { costTransactionRouteDocs } from './cost-transaction.schemas.js';

const base = '/:organizationId/projects/:projectId/cost-transactions';

export const costTransactionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(base, {
    schema: costTransactionRouteDocs.create,
    preHandler: [requireProjectPermission('project.cost_transaction.create')],
  }, handleCreateCostTransaction);
  fastify.get(base, {
    schema: costTransactionRouteDocs.list,
    preHandler: [requireProjectPermission('project.cost_transaction.read')],
  }, handleListCostTransactions);
  fastify.get(`${base}/:transactionId`, {
    schema: costTransactionRouteDocs.get,
    preHandler: [requireProjectPermission('project.cost_transaction.read')],
  }, handleGetCostTransaction);
  fastify.post(`${base}/:transactionId/post`, {
    schema: costTransactionRouteDocs.post,
    preHandler: [requireProjectPermission('project.cost_transaction.post')],
  }, handlePostCostTransaction);
  fastify.post(`${base}/:transactionId/void`, {
    schema: costTransactionRouteDocs.void,
    preHandler: [requireProjectPermission('project.cost_transaction.void')],
  }, handleVoidCostTransaction);
};
