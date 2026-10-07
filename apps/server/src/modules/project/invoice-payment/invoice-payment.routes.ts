import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveInvoice,
  handleApprovePayment,
  handleCreateInvoice,
  handleCreatePayment,
  handleExecutePayment,
  handleGetInvoice,
  handleGetPayment,
  handleListInvoices,
  handleListPayments,
  handleRejectInvoice,
  handleRejectPayment,
  handleSubmitInvoice,
  handleSubmitPayment,
  handleUpdateInvoice,
  handleVoidInvoice,
  handleVoidPayment,
} from './invoice-payment.handler.js';

const invoices = '/:organizationId/projects/:projectId/invoices';
const payments = '/:organizationId/projects/:projectId/payments';
const params = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    invoiceId: { type: 'string' },
    paymentId: { type: 'string' },
  },
} as const;
const transitionBody = {
  type: 'object',
  required: ['expectedVersion'],
  properties: { expectedVersion: { type: 'integer', minimum: 1 } },
} as const;
const rejectBody = {
  type: 'object',
  required: ['expectedVersion', 'reason'],
  properties: {
    expectedVersion: { type: 'integer', minimum: 1 },
    reason: { type: 'string', minLength: 1, maxLength: 500 },
  },
} as const;
const idempotencyHeader = {
  type: 'object',
  required: ['idempotency-key'],
  properties: { 'idempotency-key': { type: 'string', minLength: 1, maxLength: 255 } },
} as const;
const response = { type: 'object', additionalProperties: true } as const;

export const invoicePaymentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    invoices,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Create an invoice',
        params,
        headers: idempotencyHeader,
        response: { 201: response },
      },
      preHandler: [requireProjectPermission('project.invoice.create')],
    },
    handleCreateInvoice,
  );
  fastify.get(
    invoices,
    {
      schema: {
        tags: ['commercial'],
        summary: 'List invoices',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.invoice.read')],
    },
    handleListInvoices,
  );
  fastify.get(
    `${invoices}/:invoiceId`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Get an invoice',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.invoice.read')],
    },
    handleGetInvoice,
  );
  fastify.patch(
    `${invoices}/:invoiceId`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Update a draft invoice',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.invoice.update')],
    },
    handleUpdateInvoice,
  );
  const invoiceTransitions = [
    ['submit', handleSubmitInvoice, 'project.invoice.submit', transitionBody],
    ['approve', handleApproveInvoice, 'project.invoice.approve', transitionBody],
    ['reject', handleRejectInvoice, 'project.invoice.reject', rejectBody],
    ['void', handleVoidInvoice, 'project.invoice.void', transitionBody],
  ] as const;
  for (const [action, handler, permission, body] of invoiceTransitions) {
    fastify.post(
      `${invoices}/:invoiceId/${action}`,
      {
        schema: {
          tags: ['commercial'],
          summary: `${action} an invoice`,
          params,
          body,
          response: { 200: response },
        },
        preHandler: [requireProjectPermission(permission)],
      },
      handler,
    );
  }
  fastify.post(
    `${invoices}/:invoiceId/payments`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Create a payment',
        params,
        headers: idempotencyHeader,
        response: { 201: response },
      },
      preHandler: [requireProjectPermission('project.payment.create')],
    },
    handleCreatePayment,
  );
  fastify.get(
    payments,
    {
      schema: {
        tags: ['commercial'],
        summary: 'List payments',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment.read')],
    },
    handleListPayments,
  );
  fastify.get(
    `${payments}/:paymentId`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Get a payment',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment.read')],
    },
    handleGetPayment,
  );
  const paymentTransitions = [
    ['submit', handleSubmitPayment, 'project.payment.submit', transitionBody],
    ['approve', handleApprovePayment, 'project.payment.approve', transitionBody],
    ['reject', handleRejectPayment, 'project.payment.reject', rejectBody],
    ['execute', handleExecutePayment, 'project.payment.execute', transitionBody],
    ['void', handleVoidPayment, 'project.payment.void', transitionBody],
  ] as const;
  for (const [action, handler, permission, body] of paymentTransitions) {
    fastify.post(
      `${payments}/:paymentId/${action}`,
      {
        schema: {
          tags: ['commercial'],
          summary: `${action} a payment`,
          params,
          body,
          ...(action === 'execute' ? { headers: idempotencyHeader } : {}),
          response: { 200: response },
        },
        preHandler: [requireProjectPermission(permission)],
      },
      handler,
    );
  }
};
