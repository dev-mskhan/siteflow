import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveChangeOrder,
  handleClientApproveChangeOrder,
  handleCreateChangeOrder,
  handleEffectChangeOrder,
  handleGetChangeOrder,
  handleListChangeOrders,
  handleRejectChangeOrder,
  handleSubmitChangeOrder,
  handleUpdateChangeOrder,
  handleVoidChangeOrder,
} from './change-order.handler.js';

const base = '/:organizationId/projects/:projectId/change-orders';
const params = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    changeOrderId: { type: 'string' },
  },
} as const;
const transitionBody = {
  type: 'object',
  required: ['expectedVersion'],
  properties: { expectedVersion: { type: 'integer', minimum: 1 } },
} as const;
const response = { type: 'object', additionalProperties: true } as const;

export const changeOrderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(base, {
    schema: { tags: ['commercial'], summary: 'Create a draft change order', params, response: { 201: response } },
    preHandler: [requireProjectPermission('project.change_order.create')],
  }, handleCreateChangeOrder);
  fastify.get(base, {
    schema: { tags: ['commercial'], summary: 'List project change orders', params, response: { 200: response } },
    preHandler: [requireProjectPermission('project.change_order.read')],
  }, handleListChangeOrders);
  fastify.get(`${base}/:changeOrderId`, {
    schema: { tags: ['commercial'], summary: 'Get a project change order', params, response: { 200: response } },
    preHandler: [requireProjectPermission('project.change_order.read')],
  }, handleGetChangeOrder);
  fastify.patch(`${base}/:changeOrderId`, {
    schema: { tags: ['commercial'], summary: 'Update a draft change order', params, response: { 200: response } },
    preHandler: [requireProjectPermission('project.change_order.update')],
  }, handleUpdateChangeOrder);
  fastify.post(`${base}/:changeOrderId/submit`, {
    schema: { tags: ['commercial'], summary: 'Submit a change order', params, body: transitionBody, response: { 200: response } },
    preHandler: [requireProjectPermission('project.change_order.submit')],
  }, handleSubmitChangeOrder);
  fastify.post(`${base}/:changeOrderId/approve`, {
    schema: { tags: ['commercial'], summary: 'Approve a change order internally', params, body: transitionBody, response: { 200: response } },
    preHandler: [requireProjectPermission('project.change_order.approve')],
  }, handleApproveChangeOrder);
  fastify.post(`${base}/:changeOrderId/client-approve`, {
    schema: { tags: ['commercial'], summary: 'Record client approval of a change order', params, body: transitionBody, response: { 200: response } },
    preHandler: [requireProjectPermission('project.change_order.client_approve')],
  }, handleClientApproveChangeOrder);
  fastify.post(`${base}/:changeOrderId/reject`, {
    schema: {
      tags: ['commercial'],
      summary: 'Reject a change order',
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
    preHandler: [requireProjectPermission('project.change_order.approve')],
  }, handleRejectChangeOrder);
  fastify.post(`${base}/:changeOrderId/effect`, {
    schema: { tags: ['commercial'], summary: 'Apply an approved change order to the project budget', params, body: transitionBody, response: { 200: response } },
    preHandler: [requireProjectPermission('project.change_order.effect')],
  }, handleEffectChangeOrder);
  fastify.post(`${base}/:changeOrderId/void`, {
    schema: { tags: ['commercial'], summary: 'Void a non-effective change order', params, body: transitionBody, response: { 200: response } },
    preHandler: [requireProjectPermission('project.change_order.void')],
  }, handleVoidChangeOrder);
};
