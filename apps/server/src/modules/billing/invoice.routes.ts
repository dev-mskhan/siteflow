import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  SAAS_INVOICE_HISTORY_DEFAULT_LIMIT,
  SAAS_INVOICE_HISTORY_MAX_ATTEMPTS_PER_INVOICE,
  SAAS_INVOICE_HISTORY_MAX_LIMIT,
  saasInvoiceHistoryDataSchema,
  saasInvoiceHistoryQuerySchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../shared/response.js';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import { invoiceService } from './invoice.service.js';

const historyResponseProperties = {
  id: { type: 'string', format: 'uuid' },
  invoiceNumber: { type: 'string', nullable: true, maxLength: 255 },
  status: { type: 'string', enum: ['DRAFT', 'OPEN', 'PAID', 'UNCOLLECTIBLE', 'VOID'] },
  amountDueCents: { type: 'integer', minimum: 0 },
  amountPaidCents: { type: 'integer', minimum: 0 },
  currency: { type: 'string', pattern: '^[a-z]{3}$' },
  periodStart: { type: 'string', format: 'date-time' },
  periodEnd: { type: 'string', format: 'date-time' },
  hostedInvoiceUrl: { type: 'string', format: 'uri', nullable: true },
  invoicePdfUrl: { type: 'string', format: 'uri', nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
  paymentAttempts: {
    type: 'array',
    maxItems: SAAS_INVOICE_HISTORY_MAX_ATTEMPTS_PER_INVOICE,
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'status', 'amountCents', 'currency', 'attemptedAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['FAILED', 'SUCCEEDED'] },
        amountCents: { type: 'integer', minimum: 0 },
        currency: { type: 'string', pattern: '^[a-z]{3}$' },
        attemptedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};

const apiErrorResponseSchema = {
  type: 'object',
  required: ['success', 'error'],
  properties: {
    success: { type: 'boolean', const: false },
    error: {
      type: 'object',
      required: ['code', 'message', 'requestId'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  },
};

export const invoiceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', organizationContext);

  app.get<{ Params: { organizationId: string }; Querystring: { limit?: number } }>(
    '/:organizationId/billing/invoices',
    {
      preHandler: [requirePermission('billing:read')],
      schema: {
        tags: ['billing'],
        summary: 'List an organization’s SaaS invoice and payment history',
        description:
          'Returns only tenant-scoped SaaS subscription invoices and payment attempts. Construction-finance records are not included.',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['organizationId'],
          properties: { organizationId: { type: 'string', format: 'uuid' } },
        },
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: SAAS_INVOICE_HISTORY_MAX_LIMIT,
              default: SAAS_INVOICE_HISTORY_DEFAULT_LIMIT,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['success', 'data'],
            properties: {
              success: { type: 'boolean', const: true },
              data: {
                type: 'object',
                additionalProperties: false,
                required: ['invoices'],
                properties: {
                  invoices: {
                    type: 'array',
                    maxItems: SAAS_INVOICE_HISTORY_MAX_LIMIT,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'id',
                        'invoiceNumber',
                        'status',
                        'amountDueCents',
                        'amountPaidCents',
                        'currency',
                        'periodStart',
                        'periodEnd',
                        'hostedInvoiceUrl',
                        'invoicePdfUrl',
                        'createdAt',
                        'paymentAttempts',
                      ],
                      properties: historyResponseProperties,
                    },
                  },
                },
              },
              meta: { type: 'object' },
            },
          },
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { organizationId: string };
        Querystring: { limit?: number };
      }>,
      reply: FastifyReply,
    ) => {
      const { limit } = saasInvoiceHistoryQuerySchema.parse(request.query);
      const data = saasInvoiceHistoryDataSchema.parse({
        invoices: await invoiceService.getHistory(request.params.organizationId, limit),
      });
      return reply.status(200).send(createSuccessResponse(data));
    },
  );
};
