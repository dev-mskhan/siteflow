import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleGetCostCodeCommercialSummary,
  handleGetProjectCommercialSummary,
} from './commercial-summary.handler.js';

const base = '/:organizationId/projects/:projectId';
const responseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        costCode: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              properties: {
                id: { type: 'string' },
                code: { type: 'string' },
                description: { type: ['string', 'null'] },
              },
              required: ['id', 'code', 'description'],
            },
          ],
        },
        currencyBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              currencyCode: { type: 'string' },
              originalBudget: { type: 'string' },
              approvedBudgetChanges: { type: 'string' },
              revisedBudget: { type: 'string' },
              committed: { type: 'string' },
              postedActual: { type: 'string' },
              forecast: { type: ['string', 'null'] },
              variance: { type: ['string', 'null'] },
              approvedRevisionNumber: { type: ['integer', 'null'] },
            },
            required: [
              'currencyCode',
              'originalBudget',
              'approvedBudgetChanges',
              'revisedBudget',
              'committed',
              'postedActual',
              'forecast',
              'variance',
              'approvedRevisionNumber',
            ],
          },
        },
        forecastBasis: { type: ['string', 'null'] },
        forecastUnavailableReason: { type: 'string' },
        commitmentCoverage: { type: 'string' },
        subcontractCommitments: { type: 'string' },
        invoiceLifecycleCoverage: { type: 'string' },
      },
      required: [
        'costCode',
        'currencyBreakdown',
        'forecastBasis',
        'forecastUnavailableReason',
        'commitmentCoverage',
        'subcontractCommitments',
        'invoiceLifecycleCoverage',
      ],
    },
  },
  required: ['success', 'data'],
} as const;

export const commercialSummaryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(`${base}/commercial-summary`, {
    schema: {
      tags: ['commercial'],
      summary: 'Read project budget, PO commitment, and posted actual totals by currency',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['organizationId', 'projectId'],
        properties: {
          organizationId: { type: 'string' },
          projectId: { type: 'string' },
        },
      },
      response: { 200: responseSchema },
    },
    preHandler: [requireProjectPermission('project.budget.read')],
  }, handleGetProjectCommercialSummary);

  fastify.get(`${base}/cost-codes/:costCodeId/commercial-summary`, {
    schema: {
      tags: ['commercial'],
      summary: 'Read commercial totals for one project cost code',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['organizationId', 'projectId', 'costCodeId'],
        properties: {
          organizationId: { type: 'string' },
          projectId: { type: 'string' },
          costCodeId: { type: 'string' },
        },
      },
      response: { 200: responseSchema },
    },
    preHandler: [requireProjectPermission('project.budget.read')],
  }, handleGetCostCodeCommercialSummary);
};
