import type { FastifyPluginAsync, FastifySchema } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  attachQualityDocumentHandler,
  closeQualityDeficiencyHandler,
  completeCorrectiveActionHandler,
  completeQualityInspectionHandler,
  createQualityHandler,
  getQualityHandler,
  listQualityHandler,
  resolveQualityDeficiencyHandler,
  startQualityInspectionHandler,
  updateQualityHandler,
  verifyCorrectiveActionHandler,
} from './quality.handler.js';
import type { QualityEntityType } from './quality.repository.js';

const params = {
  type: 'object',
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: ['organizationId', 'projectId'],
};

const config: Record<QualityEntityType, {
  base: string;
  idKey: string;
  readCapability: string;
  manageCapability: string;
}> = {
  inspection: {
    base: 'quality-inspections',
    idKey: 'inspectionId',
    readCapability: 'project.quality.read',
    manageCapability: 'project.quality.inspect',
  },
  deficiency: {
    base: 'quality-deficiencies',
    idKey: 'deficiencyId',
    readCapability: 'project.quality.read',
    manageCapability: 'project.quality.manage_deficiency',
  },
  action: {
    base: 'corrective-actions',
    idKey: 'actionId',
    readCapability: 'project.quality.read',
    manageCapability: 'project.quality.manage_deficiency',
  },
};

function resourceParams(idKey: string) {
  return {
    ...params,
    properties: {
      ...params.properties,
      [idKey]: { type: 'string', minLength: 1, maxLength: 128 },
    },
    required: [...params.required, idKey],
  };
}

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
    tags: ['quality'],
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

const inspectionBody = {
  type: 'object',
  properties: {
    inspectionType: { type: 'string', minLength: 1, maxLength: 255 },
    scheduledDate: { type: ['string', 'null'], format: 'date' },
    inspectorMemberId: { type: ['string', 'null'], maxLength: 128 },
    location: { type: ['string', 'null'], maxLength: 500 },
    notes: { type: ['string', 'null'], maxLength: 5000 },
  },
  required: ['inspectionType'],
};
const deficiencyBody = {
  type: 'object',
  properties: {
    inspectionId: { type: ['string', 'null'], maxLength: 128 },
    title: { type: 'string', minLength: 1, maxLength: 500 },
    description: { type: ['string', 'null'], maxLength: 5000 },
    severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    responsibleMemberId: { type: ['string', 'null'], maxLength: 128 },
    dueDate: { type: ['string', 'null'], format: 'date' },
    location: { type: ['string', 'null'], maxLength: 500 },
    notes: { type: ['string', 'null'], maxLength: 5000 },
  },
  required: ['title'],
};
const actionBody = {
  type: 'object',
  properties: {
    sourceType: {
      type: 'string',
      enum: ['QUALITY_DEFICIENCY', 'SAFETY_INCIDENT', 'SAFETY_OBSERVATION'],
    },
    sourceId: { type: 'string', minLength: 1, maxLength: 128 },
    title: { type: 'string', minLength: 1, maxLength: 500 },
    description: { type: ['string', 'null'], maxLength: 5000 },
    assignedTo: { type: ['string', 'null'], maxLength: 128 },
    dueDate: { type: ['string', 'null'], format: 'date' },
    notes: { type: ['string', 'null'], maxLength: 5000 },
  },
  required: ['sourceType', 'sourceId', 'title'],
};
const listQueryByEntity = {
  inspection: {
    type: 'object',
    properties: {
      cursor: { type: 'string', minLength: 1, maxLength: 512 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
    },
  },
  deficiency: {
    type: 'object',
    properties: {
      cursor: { type: 'string', minLength: 1, maxLength: 512 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DISPUTED', 'CANCELLED'] },
      severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      inspectionId: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
  action: {
    type: 'object',
    properties: {
      cursor: { type: 'string', minLength: 1, maxLength: 512 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED'] },
      sourceType: { type: 'string', enum: ['QUALITY_DEFICIENCY', 'SAFETY_INCIDENT', 'SAFETY_OBSERVATION'] },
      sourceId: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
} satisfies Record<QualityEntityType, object>;
const completeInspectionBody = {
  type: 'object',
  properties: {
    result: { type: 'string', enum: ['PASS', 'PASS_WITH_CONDITIONS', 'FAIL'] },
    findings: { type: ['string', 'null'], maxLength: 5000 },
    performedDate: { type: 'string', format: 'date' },
  },
  required: ['result', 'performedDate'],
};
const documentBody = {
  type: 'object',
  properties: { documentId: { type: 'string', minLength: 1, maxLength: 128 } },
  required: ['documentId'],
};

const entityData = (key: string) => ({
  type: 'object',
  properties: { [key]: { type: 'object', additionalProperties: true } },
  required: [key],
});
const rowKey = (entity: QualityEntityType) => entity === 'inspection'
  ? 'inspection' : entity === 'deficiency' ? 'deficiency' : 'action';
const bodyFor = (entity: QualityEntityType) => entity === 'inspection'
  ? inspectionBody : entity === 'deficiency' ? deficiencyBody : actionBody;

export const qualityRoutes: FastifyPluginAsync = async (fastify) => {
  for (const entity of Object.keys(config) as QualityEntityType[]) {
    const item = config[entity];
    const idParams = resourceParams(item.idKey);
    const baseBody = bodyFor(entity);
    fastify.post(`/:organizationId/projects/:projectId/${item.base}`, {
      schema: routeSchema(`Create ${entity}`, entityData(rowKey(entity)), { body: baseBody }),
      preHandler: [requireProjectPermission(item.manageCapability)],
    }, createQualityHandler(entity));
    fastify.get(`/:organizationId/projects/:projectId/${item.base}`, {
      schema: routeSchema(`List ${entity}`, {
        type: 'object',
        properties: {
          data: { type: 'array', items: { type: 'object', additionalProperties: true } },
          nextCursor: { type: ['string', 'null'] },
        },
        required: ['data', 'nextCursor'],
      }, { querystring: listQueryByEntity[entity] }),
      preHandler: [requireProjectPermission(item.readCapability)],
    }, listQualityHandler(entity));
    fastify.get(`/:organizationId/projects/:projectId/${item.base}/:${item.idKey}`, {
      schema: routeSchema(`Get ${entity}`, entityData(rowKey(entity)), { params: idParams }),
      preHandler: [requireProjectPermission(item.readCapability)],
    }, getQualityHandler(entity));
    fastify.patch(`/:organizationId/projects/:projectId/${item.base}/:${item.idKey}`, {
      schema: routeSchema(`Update ${entity}`, entityData(rowKey(entity)), {
        params: idParams,
        body: { type: 'object', properties: baseBody.properties, minProperties: 1 },
      }),
      preHandler: [requireProjectPermission(item.manageCapability)],
    }, updateQualityHandler(entity));
  }

  fastify.post('/:organizationId/projects/:projectId/quality-inspections/:inspectionId/start', {
    schema: routeSchema('Start quality inspection', entityData('inspection'), {
      params: resourceParams('inspectionId'),
    }),
    preHandler: [requireProjectPermission('project.quality.inspect')],
  }, startQualityInspectionHandler);
  fastify.post('/:organizationId/projects/:projectId/quality-inspections/:inspectionId/complete', {
    schema: routeSchema('Complete quality inspection', entityData('inspection'), {
      params: resourceParams('inspectionId'),
      body: completeInspectionBody,
    }),
    preHandler: [requireProjectPermission('project.quality.inspect')],
  }, completeQualityInspectionHandler);
  fastify.post('/:organizationId/projects/:projectId/quality-inspections/:inspectionId/documents', {
    schema: routeSchema('Attach document to quality inspection', {}, {
      params: resourceParams('inspectionId'),
      body: documentBody,
      noContent: true,
    }),
    preHandler: [requireProjectPermission('project.quality.inspect')],
  }, (request, reply) => attachQualityDocumentHandler('inspection', request, reply));

  fastify.post('/:organizationId/projects/:projectId/quality-deficiencies/:deficiencyId/resolve', {
    schema: routeSchema('Resolve quality deficiency', entityData('deficiency'), {
      params: resourceParams('deficiencyId'),
    }),
    preHandler: [requireProjectPermission('project.quality.manage_deficiency')],
  }, resolveQualityDeficiencyHandler);
  fastify.post('/:organizationId/projects/:projectId/quality-deficiencies/:deficiencyId/close', {
    schema: routeSchema('Close quality deficiency', entityData('deficiency'), {
      params: resourceParams('deficiencyId'),
    }),
    preHandler: [requireProjectPermission('project.quality.manage_deficiency')],
  }, closeQualityDeficiencyHandler);
  fastify.post('/:organizationId/projects/:projectId/quality-deficiencies/:deficiencyId/documents', {
    schema: routeSchema('Attach document to quality deficiency', {}, {
      params: resourceParams('deficiencyId'),
      body: documentBody,
      noContent: true,
    }),
    preHandler: [requireProjectPermission('project.quality.manage_deficiency')],
  }, (request, reply) => attachQualityDocumentHandler('deficiency', request, reply));

  fastify.post('/:organizationId/projects/:projectId/corrective-actions/:actionId/complete', {
    schema: routeSchema('Complete corrective action', entityData('action'), {
      params: resourceParams('actionId'),
    }),
    preHandler: [requireProjectPermission('project.quality.manage_deficiency')],
  }, completeCorrectiveActionHandler);
  fastify.post('/:organizationId/projects/:projectId/corrective-actions/:actionId/verify', {
    schema: routeSchema('Verify corrective action', entityData('action'), {
      params: resourceParams('actionId'),
      body: { type: 'object', properties: { notes: { type: ['string', 'null'], maxLength: 5000 } } },
    }),
    preHandler: [requireProjectPermission('project.quality.verify_corrective')],
  }, verifyCorrectiveActionHandler);
};
