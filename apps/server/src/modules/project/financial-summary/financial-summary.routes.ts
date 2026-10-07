import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleGetBillingSummary,
  handleGetCashSummary,
  handleGetCommitmentSummary,
  handleGetCostSummary,
  handleGetFinancialSummary,
  handleListFinancialAudit,
} from './financial-summary.handler.js';

const base = '/:organizationId/projects/:projectId';
const paramsSchema = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
  },
} as const;
const auditQuerySchema = {
  type: 'object',
  properties: {
    cursor: { type: 'string', maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    action: { type: 'string', minLength: 1, maxLength: 128 },
    entityType: { type: 'string', minLength: 1, maxLength: 128 },
    entityId: { type: 'string', minLength: 1, maxLength: 128 },
  },
} as const;

export const financialSummaryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    `${base}/financial-summary`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Read scoped cost, approved-PO commitment, billing, retainage, and cash summaries',
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
      preHandler: [requireProjectPermission('project.financial_summary.read')],
    },
    handleGetFinancialSummary,
  );

  const summaryRoutes = [
    [
      '/cost-summary',
      'Read project cost totals and documented forecast coverage',
      handleGetCostSummary,
    ],
    [
      '/commitment-summary',
      'Read approved purchase-order commitments only',
      handleGetCommitmentSummary,
    ],
    [
      '/billing-summary',
      'Read project contract, billing, outstanding, and retainage totals',
      handleGetBillingSummary,
    ],
    ['/cash-summary', 'Read executed cash received, paid, and net totals', handleGetCashSummary],
  ] as const;
  for (const [path, summary, handler] of summaryRoutes) {
    fastify.get(
      `${base}${path}`,
      {
        schema: {
          tags: ['commercial'],
          summary,
          security: [{ bearerAuth: [] }],
          params: paramsSchema,
        },
        preHandler: [requireProjectPermission('project.financial_summary.read')],
      },
      handler,
    );
  }

  fastify.get(
    `${base}/financial-audit`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Read bounded, cursor-paginated project financial audit events',
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        querystring: auditQuerySchema,
      },
      preHandler: [requireProjectPermission('project.financial_audit.read')],
    },
    handleListFinancialAudit,
  );

  fastify.get(
    `${base}/change-orders/:changeOrderId/audit`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Read financial audit events for a scoped change order',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['organizationId', 'projectId', 'changeOrderId'],
          properties: {
            ...paramsSchema.properties,
            changeOrderId: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
        querystring: auditQuerySchema,
      },
      preHandler: [requireProjectPermission('project.financial_audit.read')],
    },
    handleListFinancialAudit,
  );
};
