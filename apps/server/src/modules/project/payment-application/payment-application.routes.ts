import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApprovePaymentApplication,
  handleCreatePaymentApplication,
  handleGetPaymentApplication,
  handleListPaymentApplications,
  handleRejectPaymentApplication,
  handleSubmitPaymentApplication,
  handleUnderReviewPaymentApplication,
  handleUpdatePaymentApplication,
  handleVoidPaymentApplication,
} from './payment-application.handler.js';

const base = '/:organizationId/projects/:projectId/payment-applications';
const params = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    paymentApplicationId: { type: 'string' },
  },
} as const;
const transitionBody = {
  type: 'object',
  required: ['expectedVersion'],
  properties: { expectedVersion: { type: 'integer', minimum: 1 } },
} as const;
const response = { type: 'object', additionalProperties: true } as const;

export const paymentApplicationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    base,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Create a payment application',
        params,
        response: { 201: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.create')],
    },
    handleCreatePaymentApplication,
  );
  fastify.get(
    base,
    {
      schema: {
        tags: ['commercial'],
        summary: 'List payment applications',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.read')],
    },
    handleListPaymentApplications,
  );
  fastify.get(
    `${base}/:paymentApplicationId`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Get a payment application',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.read')],
    },
    handleGetPaymentApplication,
  );
  fastify.patch(
    `${base}/:paymentApplicationId`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Update a draft payment application',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.update')],
    },
    handleUpdatePaymentApplication,
  );
  fastify.post(
    `${base}/:paymentApplicationId/submit`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Submit a payment application',
        params,
        body: transitionBody,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.submit')],
    },
    handleSubmitPaymentApplication,
  );
  fastify.post(
    `${base}/:paymentApplicationId/under-review`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Place a payment application under review',
        params,
        body: transitionBody,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.review')],
    },
    handleUnderReviewPaymentApplication,
  );
  fastify.post(
    `${base}/:paymentApplicationId/approve`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Approve or partially approve a payment application',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.approve')],
    },
    handleApprovePaymentApplication,
  );
  fastify.post(
    `${base}/:paymentApplicationId/reject`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Reject a payment application',
        params,
        body: {
          type: 'object',
          required: ['expectedVersion', 'reason'],
          properties: {
            expectedVersion: { type: 'integer', minimum: 1 },
            reason: { type: 'string', minLength: 1, maxLength: 500 },
          },
        },
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.approve')],
    },
    handleRejectPaymentApplication,
  );
  fastify.post(
    `${base}/:paymentApplicationId/void`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Void a draft or rejected payment application',
        params,
        body: transitionBody,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.payment_application.void')],
    },
    handleVoidPaymentApplication,
  );
};
