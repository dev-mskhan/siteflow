import type { FastifyPluginAsync, FastifySchema } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  attachRfiDocumentHandler,
  cancelRfiHandler,
  closeRfiHandler,
  createRfiHandler,
  getRfiHandler,
  listRfisHandler,
  respondRfiHandler,
  submitRfiHandler,
  updateRfiHandler,
} from './rfi.handler.js';

const params = {
  type: 'object',
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: ['organizationId', 'projectId'],
};
const resourceParams = {
  ...params,
  properties: {
    ...params.properties,
    rfiId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: [...params.required, 'rfiId'],
};

function response(data: object) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data,
      meta: {
        type: 'object',
        properties: { timestamp: { type: 'string' } },
        required: ['timestamp'],
      },
    },
    required: ['success', 'data', 'meta'],
  };
}

function schema(summary: string, data: object, options: {
  params?: object;
  body?: object;
  querystring?: object;
  noContent?: boolean;
} = {}): FastifySchema {
  return {
    tags: ['rfis'],
    summary,
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    params: options.params ?? params,
    ...(options.body ? { body: options.body } : {}),
    ...(options.querystring ? { querystring: options.querystring } : {}),
    response: options.noContent
      ? { 204: { type: 'null' } }
      : { 200: response(data), 201: response(data) },
  };
}

const rfiData = {
  type: 'object',
  properties: { rfi: { type: 'object', additionalProperties: true } },
  required: ['rfi'],
};
const mutationBody = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 500 },
    question: { type: 'string', minLength: 1, maxLength: 20000 },
    discipline: { type: ['string', 'null'], maxLength: 255 },
    priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
    recipientName: { type: ['string', 'null'], maxLength: 255 },
    dueDate: { type: ['string', 'null'], format: 'date' },
    scheduleImpactDays: { type: 'integer', minimum: -36500, maximum: 36500 },
    costImpact: { type: ['number', 'null'], minimum: -9999999999999.99, maximum: 9999999999999.99 },
    linkedTaskId: { type: ['string', 'null'], maxLength: 128 },
    notes: { type: ['string', 'null'], maxLength: 5000 },
  },
};
const respondBody = {
  type: 'object',
  properties: {
    response: { type: 'string', minLength: 1, maxLength: 20000 },
    scheduleImpactDays: { type: 'integer', minimum: -36500, maximum: 36500 },
    costImpact: { type: ['number', 'null'], minimum: -9999999999999.99, maximum: 9999999999999.99 },
  },
  required: ['response'],
};
const listQuery = {
  type: 'object',
  properties: {
    cursor: { type: 'string', minLength: 1, maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    status: { type: 'string', enum: ['DRAFT', 'OPEN', 'UNDER_REVIEW', 'ANSWERED', 'CLOSED', 'CANCELLED'] },
    priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
  },
};
const documentBody = {
  type: 'object',
  properties: { documentId: { type: 'string', minLength: 1, maxLength: 128 } },
  required: ['documentId'],
};

export const rfiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/:organizationId/projects/:projectId/rfis', {
    schema: schema('Create RFI', rfiData, {
      body: { ...mutationBody, required: ['title', 'question'] },
    }),
    preHandler: [requireProjectPermission('project.rfi.create')],
  }, createRfiHandler);

  fastify.get('/:organizationId/projects/:projectId/rfis', {
    schema: schema('List RFIs', {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', additionalProperties: true } },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['data', 'nextCursor'],
    }, { querystring: listQuery }),
    preHandler: [requireProjectPermission('project.rfi.read')],
  }, listRfisHandler);

  fastify.get('/:organizationId/projects/:projectId/rfis/:rfiId', {
    schema: schema('Get RFI', rfiData, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.rfi.read')],
  }, getRfiHandler);

  fastify.patch('/:organizationId/projects/:projectId/rfis/:rfiId', {
    schema: schema('Update draft RFI', rfiData, {
      params: resourceParams,
      body: { ...mutationBody, minProperties: 1 },
    }),
    preHandler: [requireProjectPermission('project.rfi.create')],
  }, updateRfiHandler);

  fastify.post('/:organizationId/projects/:projectId/rfis/:rfiId/submit', {
    schema: schema('Submit RFI', rfiData, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.rfi.create')],
  }, submitRfiHandler);

  fastify.post('/:organizationId/projects/:projectId/rfis/:rfiId/respond', {
    schema: schema('Respond to RFI', rfiData, { params: resourceParams, body: respondBody }),
    preHandler: [requireProjectPermission('project.rfi.respond')],
  }, respondRfiHandler);

  fastify.post('/:organizationId/projects/:projectId/rfis/:rfiId/close', {
    schema: schema('Close answered RFI', rfiData, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.rfi.manage')],
  }, closeRfiHandler);

  fastify.post('/:organizationId/projects/:projectId/rfis/:rfiId/cancel', {
    schema: schema('Cancel RFI', rfiData, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.rfi.manage')],
  }, cancelRfiHandler);

  fastify.post('/:organizationId/projects/:projectId/rfis/:rfiId/documents', {
    schema: schema('Attach document to RFI', {}, {
      params: resourceParams,
      body: documentBody,
      noContent: true,
    }),
    preHandler: [requireProjectPermission('project.rfi.create')],
  }, attachRfiDocumentHandler);
};
