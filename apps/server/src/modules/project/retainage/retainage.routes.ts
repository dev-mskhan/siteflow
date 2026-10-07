import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleHoldRetainage,
  handleListRetainage,
  handleListRetainageReleases,
  handleReleaseRetainage,
} from './retainage.handler.js';

const base = '/:organizationId/projects/:projectId/retainage';
const params = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    retainageId: { type: 'string' },
    paymentApplicationId: { type: 'string' },
  },
} as const;
const response = { type: 'object', additionalProperties: true } as const;
const idempotencyHeader = {
  type: 'object',
  required: ['idempotency-key'],
  properties: { 'idempotency-key': { type: 'string', minLength: 1, maxLength: 255 } },
} as const;
const releaseBody = {
  type: 'object',
  required: ['expectedVersion', 'amount', 'reason'],
  properties: {
    expectedVersion: { type: 'integer', minimum: 1 },
    amount: { type: 'string', pattern: '^\\d{1,13}(?:\\.\\d{1,2})?$' },
    reason: { type: 'string', minLength: 1, maxLength: 500 },
  },
} as const;

export const retainageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    base,
    {
      schema: {
        tags: ['commercial'],
        summary: 'List project retainage records',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.retainage.read')],
    },
    handleListRetainage,
  );
  fastify.post(
    '/:organizationId/projects/:projectId/payment-applications/:paymentApplicationId/retainage/hold',
    {
      schema: {
        tags: ['commercial'],
        summary: 'Hold approved payment application retainage',
        params,
        headers: idempotencyHeader,
        response: { 201: response },
      },
      preHandler: [requireProjectPermission('project.retainage.hold')],
    },
    handleHoldRetainage,
  );
  fastify.get(
    `${base}/:retainageId/releases`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'List retainage releases',
        params,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.retainage.read')],
    },
    handleListRetainageReleases,
  );
  fastify.post(
    `${base}/:retainageId/release`,
    {
      schema: {
        tags: ['commercial'],
        summary: 'Release held retainage',
        params,
        headers: idempotencyHeader,
        body: releaseBody,
        response: { 200: response },
      },
      preHandler: [requireProjectPermission('project.retainage.release')],
    },
    handleReleaseRetainage,
  );
};
