import type { FastifyPluginAsync, FastifySchema } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  attachSubmittalDocumentHandler,
  closeSubmittalHandler,
  createSubmittalHandler,
  getSubmittalHandler,
  getSubmittalRevisionHandler,
  listSubmittalRevisionsHandler,
  listSubmittalsHandler,
  resubmitSubmittalHandler,
  reviewSubmittalHandler,
  submitSubmittalHandler,
  updateSubmittalHandler,
} from './submittal.handler.js';

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
    submittalId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: [...params.required, 'submittalId'],
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
    tags: ['submittals'],
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

const submittalData = {
  type: 'object',
  properties: { submittal: { type: 'object', additionalProperties: true } },
  required: ['submittal'],
};
const createBody = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 500 },
    specReference: { type: ['string', 'null'], maxLength: 255 },
    discipline: { type: ['string', 'null'], maxLength: 255 },
    responsibleMemberId: { type: ['string', 'null'], maxLength: 128 },
    reviewerMemberId: { type: ['string', 'null'], maxLength: 128 },
    dueDate: { type: ['string', 'null'], format: 'date' },
    notes: { type: ['string', 'null'], maxLength: 5000 },
  },
  required: ['title'],
};
const reviewBody = {
  type: 'object',
  properties: {
    response: {
      type: 'string',
      enum: ['APPROVED', 'APPROVED_WITH_COMMENTS', 'REVISE_AND_RESUBMIT', 'REJECTED'],
    },
    responseNotes: { type: ['string', 'null'], maxLength: 5000 },
  },
  required: ['response'],
};
const listQuery = {
  type: 'object',
  properties: {
    cursor: { type: 'string', minLength: 1, maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    status: {
      type: 'string',
      enum: [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'REVISE_AND_RESUBMIT',
        'CLOSED',
      ],
    },
  },
};
const documentBody = {
  type: 'object',
  properties: { documentId: { type: 'string', minLength: 1, maxLength: 128 } },
  required: ['documentId'],
};

export const submittalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/:organizationId/projects/:projectId/submittals', {
    schema: schema('Create submittal', submittalData, { body: createBody }),
    preHandler: [requireProjectPermission('project.submittal.create')],
  }, createSubmittalHandler);

  fastify.get('/:organizationId/projects/:projectId/submittals', {
    schema: schema('List submittals', {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', additionalProperties: true } },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['data', 'nextCursor'],
    }, { querystring: listQuery }),
    preHandler: [requireProjectPermission('project.submittal.read')],
  }, listSubmittalsHandler);

  fastify.get('/:organizationId/projects/:projectId/submittals/:submittalId', {
    schema: schema('Get submittal', submittalData, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.submittal.read')],
  }, getSubmittalHandler);

  fastify.patch('/:organizationId/projects/:projectId/submittals/:submittalId', {
    schema: schema('Update draft submittal', submittalData, {
      params: resourceParams,
      body: { type: 'object', properties: createBody.properties, minProperties: 1 },
    }),
    preHandler: [requireProjectPermission('project.submittal.create')],
  }, updateSubmittalHandler);

  fastify.post('/:organizationId/projects/:projectId/submittals/:submittalId/submit', {
    schema: schema('Submit submittal', submittalData, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.submittal.create')],
  }, submitSubmittalHandler);

  fastify.post('/:organizationId/projects/:projectId/submittals/:submittalId/review', {
    schema: schema('Review submittal', submittalData, { params: resourceParams, body: reviewBody }),
    preHandler: [requireProjectPermission('project.submittal.review')],
  }, reviewSubmittalHandler);

  fastify.post('/:organizationId/projects/:projectId/submittals/:submittalId/resubmit', {
    schema: schema('Resubmit submittal revision', submittalData, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.submittal.create')],
  }, resubmitSubmittalHandler);

  fastify.post('/:organizationId/projects/:projectId/submittals/:submittalId/close', {
    schema: schema('Close submittal', submittalData, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.submittal.manage')],
  }, closeSubmittalHandler);

  fastify.get('/:organizationId/projects/:projectId/submittals/:submittalId/revisions', {
    schema: schema('List submittal revisions', {
      type: 'object',
      properties: { revisions: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      required: ['revisions'],
    }, { params: resourceParams }),
    preHandler: [requireProjectPermission('project.submittal.read')],
  }, listSubmittalRevisionsHandler);

  fastify.get('/:organizationId/projects/:projectId/submittals/:submittalId/revisions/:revisionId', {
    schema: schema('Get submittal revision', {
      type: 'object',
      properties: { revision: { type: 'object', additionalProperties: true } },
      required: ['revision'],
    }, {
      params: {
        ...resourceParams,
        properties: {
          ...resourceParams.properties,
          revisionId: { type: 'string', minLength: 1, maxLength: 128 },
        },
        required: [...resourceParams.required, 'revisionId'],
      },
    }),
    preHandler: [requireProjectPermission('project.submittal.read')],
  }, getSubmittalRevisionHandler);

  fastify.post('/:organizationId/projects/:projectId/submittals/:submittalId/documents', {
    schema: schema('Attach document to submittal', {}, {
      params: resourceParams,
      body: documentBody,
      noContent: true,
    }),
    preHandler: [requireProjectPermission('project.submittal.create')],
  }, attachSubmittalDocumentHandler);
};
