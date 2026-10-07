import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createInvoiceSchema,
  createPaymentSchema,
  invoiceParamsSchema,
  invoiceTransitionSchema,
  listInvoicesQuerySchema,
  listPaymentsQuerySchema,
  paymentParamsSchema,
  paymentTransitionSchema,
  rejectInvoiceSchema,
  rejectPaymentSchema,
  updateInvoiceSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { InvoicePaymentConflictError } from './invoice-payment.errors.js';
import { invoicePaymentService } from './invoice-payment.service.js';

function idempotencyKey(request: FastifyRequest) {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 255) {
    const error = new InvoicePaymentConflictError(
      'A valid Idempotency-Key header is required for this command.',
    ) as InvoicePaymentConflictError & { statusCode: number; code: string };
    error.statusCode = 400;
    error.code = 'IDEMPOTENCY_KEY_REQUIRED';
    throw error;
  }
  return value;
}

function invoiceScope(request: FastifyRequest) {
  const params = invoiceParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    invoiceId: params.invoiceId,
  };
}

function paymentScope(request: FastifyRequest) {
  const params = paymentParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    paymentId: params.paymentId,
  };
}

export async function handleCreateInvoice(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = invoiceScope(request);
  const invoice = await invoicePaymentService.createInvoice(
    request.user!.sub,
    organizationId,
    projectId,
    createInvoiceSchema.parse(request.body),
    request.id,
    idempotencyKey(request),
  );
  return reply.status(201).send(createSuccessResponse({ invoice }));
}

export async function handleListInvoices(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = invoiceScope(request);
  const result = await invoicePaymentService.listInvoices(
    organizationId,
    projectId,
    listInvoicesQuerySchema.parse(request.query),
  );
  return reply.send(createSuccessResponse(result.invoices, { nextCursor: result.nextCursor }));
}

export async function handleGetInvoice(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, invoiceId } = invoiceScope(request);
  const invoice = await invoicePaymentService.getInvoice(organizationId, projectId, invoiceId!);
  return reply.send(createSuccessResponse({ invoice }));
}

export async function handleUpdateInvoice(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, invoiceId } = invoiceScope(request);
  const invoice = await invoicePaymentService.updateInvoice(
    request.user!.sub,
    organizationId,
    projectId,
    invoiceId!,
    updateInvoiceSchema.parse(request.body),
    request.id,
  );
  return reply.send(createSuccessResponse({ invoice }));
}

async function invoiceTransition(
  request: FastifyRequest,
  operation: 'submit' | 'approve' | 'reject' | 'void',
) {
  const { organizationId, projectId, invoiceId } = invoiceScope(request);
  const body =
    operation === 'reject'
      ? rejectInvoiceSchema.parse(request.body)
      : invoiceTransitionSchema.parse(request.body);
  const reason =
    operation === 'reject' ? rejectInvoiceSchema.parse(request.body).reason : undefined;
  return invoicePaymentService.invoiceTransition(
    request.user!.sub,
    organizationId,
    projectId,
    invoiceId!,
    body.expectedVersion,
    request.id,
    operation,
    reason,
  );
}

async function sendInvoiceTransition(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: 'submit' | 'approve' | 'reject' | 'void',
) {
  const invoice = await invoiceTransition(request, operation);
  return reply.send(createSuccessResponse({ invoice }));
}

export const handleSubmitInvoice = (request: FastifyRequest, reply: FastifyReply) =>
  sendInvoiceTransition(request, reply, 'submit');
export const handleApproveInvoice = (request: FastifyRequest, reply: FastifyReply) =>
  sendInvoiceTransition(request, reply, 'approve');
export const handleRejectInvoice = (request: FastifyRequest, reply: FastifyReply) =>
  sendInvoiceTransition(request, reply, 'reject');
export const handleVoidInvoice = (request: FastifyRequest, reply: FastifyReply) =>
  sendInvoiceTransition(request, reply, 'void');

export async function handleCreatePayment(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, invoiceId } = invoiceScope(request);
  const payment = await invoicePaymentService.createPayment(
    request.user!.sub,
    organizationId,
    projectId,
    invoiceId!,
    createPaymentSchema.parse(request.body),
    request.id,
    idempotencyKey(request),
  );
  return reply.status(201).send(createSuccessResponse({ payment }));
}

export async function handleListPayments(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = paymentScope(request);
  const result = await invoicePaymentService.listPayments(
    organizationId,
    projectId,
    listPaymentsQuerySchema.parse(request.query),
  );
  return reply.send(createSuccessResponse(result.payments, { nextCursor: result.nextCursor }));
}

export async function handleGetPayment(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, paymentId } = paymentScope(request);
  const payment = await invoicePaymentService.getPayment(organizationId, projectId, paymentId!);
  return reply.send(createSuccessResponse({ payment }));
}

async function paymentTransition(
  request: FastifyRequest,
  operation: 'submit' | 'approve' | 'reject' | 'execute' | 'void',
) {
  const { organizationId, projectId, paymentId } = paymentScope(request);
  const body =
    operation === 'reject'
      ? rejectPaymentSchema.parse(request.body)
      : paymentTransitionSchema.parse(request.body);
  const reason =
    operation === 'reject' ? rejectPaymentSchema.parse(request.body).reason : undefined;
  return invoicePaymentService.paymentTransition(
    request.user!.sub,
    organizationId,
    projectId,
    paymentId!,
    body.expectedVersion,
    request.id,
    operation,
    reason,
    operation === 'execute' ? idempotencyKey(request) : undefined,
  );
}

async function sendPaymentTransition(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: 'submit' | 'approve' | 'reject' | 'execute' | 'void',
) {
  const payment = await paymentTransition(request, operation);
  return reply.send(createSuccessResponse({ payment }));
}

export const handleSubmitPayment = (request: FastifyRequest, reply: FastifyReply) =>
  sendPaymentTransition(request, reply, 'submit');
export const handleApprovePayment = (request: FastifyRequest, reply: FastifyReply) =>
  sendPaymentTransition(request, reply, 'approve');
export const handleRejectPayment = (request: FastifyRequest, reply: FastifyReply) =>
  sendPaymentTransition(request, reply, 'reject');
export const handleExecutePayment = (request: FastifyRequest, reply: FastifyReply) =>
  sendPaymentTransition(request, reply, 'execute');
export const handleVoidPayment = (request: FastifyRequest, reply: FastifyReply) =>
  sendPaymentTransition(request, reply, 'void');
