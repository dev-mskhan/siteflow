import type { FastifyPluginAsync, FastifySchema } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  attachSafetyDocumentHandler,
  closeSafetyEventHandler,
  createSafetyCorrectiveActionHandler,
  createSafetyEventHandler,
  createSafetyMeetingHandler,
  getSafetyEventHandler,
  getSafetyMeetingHandler,
  investigateSafetyEventHandler,
  listSafetyEventsHandler,
  listSafetyMeetingsHandler,
  updateSafetyEventHandler,
} from './safety.handler.js';

const params = {
  type: 'object',
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: ['organizationId', 'projectId'],
};
const eventParams = {
  ...params,
  properties: { ...params.properties, eventId: { type: 'string', minLength: 1, maxLength: 128 } },
  required: [...params.required, 'eventId'],
};
const meetingParams = {
  ...params,
  properties: { ...params.properties, meetingId: { type: 'string', minLength: 1, maxLength: 128 } },
  required: [...params.required, 'meetingId'],
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

function routeSchema(summary: string, data: object, options: {
  params?: object;
  body?: object;
  querystring?: object;
  noContent?: boolean;
} = {}): FastifySchema {
  return {
    tags: ['safety'],
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

const eventData = {
  type: 'object',
  properties: { event: { type: 'object', additionalProperties: true } },
  required: ['event'],
};
const meetingData = {
  type: 'object',
  properties: { meeting: { type: 'object', additionalProperties: true } },
  required: ['meeting'],
};
const actionData = {
  type: 'object',
  properties: { action: { type: 'object', additionalProperties: true } },
  required: ['action'],
};
const listData = {
  type: 'object',
  properties: {
    data: { type: 'array', items: { type: 'object', additionalProperties: true } },
    nextCursor: { type: ['string', 'null'] },
  },
  required: ['data', 'nextCursor'],
};

const eventBody = {
  type: 'object',
  properties: {
    eventType: { type: 'string', enum: ['INCIDENT', 'NEAR_MISS', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'FIRST_AID'] },
    title: { type: 'string', minLength: 1, maxLength: 500 },
    description: { type: 'string', minLength: 1, maxLength: 10000 },
    severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATALITY'] },
    occurredAt: { type: 'string', format: 'date-time' },
    location: { type: ['string', 'null'], maxLength: 500 },
    involvedParties: { type: ['string', 'null'], maxLength: 5000 },
    assignedTo: { type: ['string', 'null'], maxLength: 128 },
    immediateAction: { type: ['string', 'null'], maxLength: 5000 },
    notes: { type: ['string', 'null'], maxLength: 5000 },
  },
  required: ['eventType', 'title', 'description', 'occurredAt'],
};
const listEventsQuery = {
  type: 'object',
  properties: {
    cursor: { type: 'string', minLength: 1, maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    status: { type: 'string', enum: ['REPORTED', 'UNDER_INVESTIGATION', 'CORRECTIVE_ACTION_REQUIRED', 'CORRECTIVE_ACTION_IN_PROGRESS', 'CLOSED'] },
    eventType: { type: 'string', enum: ['INCIDENT', 'NEAR_MISS', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'FIRST_AID'] },
    severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATALITY'] },
  },
};
const updateEventBody = {
  type: 'object',
  properties: {
    title: eventBody.properties.title,
    description: eventBody.properties.description,
    severity: eventBody.properties.severity,
    location: eventBody.properties.location,
    involvedParties: eventBody.properties.involvedParties,
    assignedTo: eventBody.properties.assignedTo,
    rootCause: { type: ['string', 'null'], maxLength: 5000 },
    immediateAction: eventBody.properties.immediateAction,
    notes: eventBody.properties.notes,
    status: { type: 'string', enum: ['CORRECTIVE_ACTION_REQUIRED'] },
  },
  minProperties: 1,
};
const meetingBody = {
  type: 'object',
  properties: {
    meetingType: { type: 'string', minLength: 1, maxLength: 255 },
    title: { type: 'string', minLength: 1, maxLength: 500 },
    scheduledAt: { type: 'string', format: 'date-time' },
    conductedAt: { type: ['string', 'null'], format: 'date-time' },
    facilitatorId: { type: ['string', 'null'], maxLength: 128 },
    attendeeCount: { type: ['integer', 'null'], minimum: 0, maximum: 10000 },
    topicsCovered: { type: ['string', 'null'], maxLength: 10000 },
    notes: { type: ['string', 'null'], maxLength: 5000 },
  },
  required: ['meetingType', 'title', 'scheduledAt'],
};
const listMeetingsQuery = {
  type: 'object',
  properties: {
    cursor: { type: 'string', minLength: 1, maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
};

export const safetyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/:organizationId/projects/:projectId/safety-events', {
    schema: routeSchema('Report safety event', eventData, { body: eventBody }),
    preHandler: [requireProjectPermission('project.safety.report')],
  }, createSafetyEventHandler);
  fastify.get('/:organizationId/projects/:projectId/safety-events', {
    schema: routeSchema('List safety events', listData, { querystring: listEventsQuery }),
    preHandler: [requireProjectPermission('project.safety.read')],
  }, listSafetyEventsHandler);
  fastify.get('/:organizationId/projects/:projectId/safety-events/:eventId', {
    schema: routeSchema('Get safety event', eventData, { params: eventParams }),
    preHandler: [requireProjectPermission('project.safety.read')],
  }, getSafetyEventHandler);
  fastify.patch('/:organizationId/projects/:projectId/safety-events/:eventId', {
    schema: routeSchema('Update safety event', eventData, {
      params: eventParams,
      body: updateEventBody,
    }),
    preHandler: [requireProjectPermission('project.safety.manage')],
  }, updateSafetyEventHandler);
  fastify.post('/:organizationId/projects/:projectId/safety-events/:eventId/investigate', {
    schema: routeSchema('Investigate safety event', eventData, {
      params: eventParams,
      body: {
        type: 'object',
        properties: {
          rootCause: { type: ['string', 'null'], maxLength: 5000 },
          immediateAction: { type: ['string', 'null'], maxLength: 5000 },
        },
      },
    }),
    preHandler: [requireProjectPermission('project.safety.investigate')],
  }, investigateSafetyEventHandler);
  fastify.post('/:organizationId/projects/:projectId/safety-events/:eventId/close', {
    schema: routeSchema('Close safety event', eventData, {
      params: eventParams,
      body: {
        type: 'object',
        properties: { notes: { type: 'string', minLength: 1, maxLength: 5000 } },
        required: ['notes'],
      },
    }),
    preHandler: [requireProjectPermission('project.safety.manage')],
  }, closeSafetyEventHandler);
  fastify.post('/:organizationId/projects/:projectId/safety-events/:eventId/corrective-actions', {
    schema: routeSchema('Create safety corrective action', actionData, {
      params: eventParams,
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 500 },
          description: { type: ['string', 'null'], maxLength: 5000 },
          assignedTo: { type: ['string', 'null'], maxLength: 128 },
          dueDate: { type: ['string', 'null'], format: 'date' },
          notes: { type: ['string', 'null'], maxLength: 5000 },
        },
        required: ['title'],
      },
    }),
    preHandler: [requireProjectPermission('project.safety.manage')],
  }, createSafetyCorrectiveActionHandler);
  fastify.post('/:organizationId/projects/:projectId/safety-events/:eventId/documents', {
    schema: routeSchema('Attach document to safety event', {}, {
      params: eventParams,
      body: {
        type: 'object',
        properties: { documentId: { type: 'string', minLength: 1, maxLength: 128 } },
        required: ['documentId'],
      },
      noContent: true,
    }),
    preHandler: [requireProjectPermission('project.safety.manage')],
  }, attachSafetyDocumentHandler);

  fastify.post('/:organizationId/projects/:projectId/safety-meetings', {
    schema: routeSchema('Create safety meeting', meetingData, { body: meetingBody }),
    preHandler: [requireProjectPermission('project.safety.manage')],
  }, createSafetyMeetingHandler);
  fastify.get('/:organizationId/projects/:projectId/safety-meetings', {
    schema: routeSchema('List safety meetings', listData, { querystring: listMeetingsQuery }),
    preHandler: [requireProjectPermission('project.safety.read')],
  }, listSafetyMeetingsHandler);
  fastify.get('/:organizationId/projects/:projectId/safety-meetings/:meetingId', {
    schema: routeSchema('Get safety meeting', meetingData, { params: meetingParams }),
    preHandler: [requireProjectPermission('project.safety.read')],
  }, getSafetyMeetingHandler);
};
