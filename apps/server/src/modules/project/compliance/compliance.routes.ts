import type { FastifyPluginAsync, FastifySchema } from 'fastify';
import type { ZodTypeAny } from 'zod';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  attachComplianceDocumentHandler,
  completeComplianceInspectionHandler,
  complianceSchemas,
  createComplianceHandler,
  deleteComplianceHandler,
  getComplianceHandler,
  listComplianceHandler,
  listExpiringItemsHandler,
  transitionPermitHandler,
  updateComplianceHandler,
  verifyComplianceRecordHandler,
} from './compliance.handler.js';
import type { ComplianceEntityType } from './compliance.repository.js';

const baseParams = {
  type: 'object',
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: ['organizationId', 'projectId'],
};

function params(entity: ComplianceEntityType) {
  const idKey = entity === 'permit' ? 'permitId' : entity === 'inspection' ? 'inspectionId' : 'recordId';
  return {
    type: 'object',
    properties: {
      ...baseParams.properties,
      [idKey]: { type: 'string', minLength: 1, maxLength: 128 },
    },
    required: [...baseParams.required, idKey],
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
  entity?: ComplianceEntityType;
  body?: object;
  querystring?: object;
} = {}): FastifySchema {
  return {
    tags: ['compliance'],
    summary,
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    params: options.entity ? params(options.entity) : baseParams,
    ...(options.body ? { body: options.body } : {}),
    ...(options.querystring ? { querystring: options.querystring } : {}),
    response: { 200: response(data), 201: response(data) },
  };
}

const recordResult = (key: string) => ({
  type: 'object',
  properties: { [key]: { type: 'object', additionalProperties: true } },
  required: [key],
});

const querySchema = {
  type: 'object',
  properties: {
    cursor: { type: 'string', maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    status: { type: 'string' },
  },
};

const schemaFor: Record<ComplianceEntityType, {
  base: string;
  cap: string;
  create: ZodTypeAny;
  update: ZodTypeAny;
}> = {
  permit: {
    base: 'permits',
    cap: 'project.permit',
    create: complianceSchemas.createPermitSchema,
    update: complianceSchemas.updatePermitSchema,
  },
  inspection: {
    base: 'compliance-inspections',
    cap: 'project.compliance_inspection',
    create: complianceSchemas.createComplianceInspectionSchema,
    update: complianceSchemas.updateComplianceInspectionSchema,
  },
  record: {
    base: 'compliance-records',
    cap: 'project.compliance_record',
    create: complianceSchemas.createComplianceRecordSchema,
    update: complianceSchemas.updateComplianceRecordSchema,
  },
};

const permitTransitionBody = {
  type: 'object',
  properties: { status: { type: 'string', enum: ['APPLIED', 'ISSUED', 'ACTIVE', 'REVOKED', 'CANCELLED'] } },
  required: ['status'],
};
const completeInspectionBody = {
  type: 'object',
  properties: {
    result: { type: 'string', enum: ['PASS', 'PASS_WITH_CONDITIONS', 'FAIL', 'INCONCLUSIVE'] },
    findings: { type: ['string', 'null'], maxLength: 5000 },
    performedDate: { type: 'string', format: 'date' },
  },
  required: ['result', 'performedDate'],
};
const verifyBody = {
  type: 'object',
  properties: { verificationRef: { type: 'string', maxLength: 500 } },
};
const documentBody = {
  type: 'object',
  properties: { documentId: { type: 'string', minLength: 1, maxLength: 128 } },
  required: ['documentId'],
};

const listStatusEnums: Record<ComplianceEntityType, string[]> = {
  permit: ['PENDING', 'APPLIED', 'ISSUED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'CANCELLED'],
  inspection: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'],
  record: ['PENDING', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED', 'VERIFIED'],
};

function bodySchema(entity: ComplianceEntityType, update = false) {
  const commonText = { type: ['string', 'null'], maxLength: 5000 };
  const properties: Record<string, object> = entity === 'permit'
    ? {
        permitType: { type: 'string', minLength: 1, maxLength: 255 },
        referenceNumber: { type: ['string', 'null'], maxLength: 255 },
        issuingAuthority: { type: ['string', 'null'], maxLength: 255 },
        responsibleMemberId: { type: ['string', 'null'], maxLength: 128 },
        issueDate: { type: ['string', 'null'], format: 'date' },
        effectiveDate: { type: ['string', 'null'], format: 'date' },
        expiryDate: { type: ['string', 'null'], format: 'date' },
        notes: commonText,
      }
    : entity === 'inspection'
      ? {
          permitId: { type: ['string', 'null'], maxLength: 128 },
          inspectionType: { type: 'string', minLength: 1, maxLength: 255 },
          scheduledDate: { type: ['string', 'null'], format: 'date' },
          inspectorName: { type: ['string', 'null'], maxLength: 255 },
          responsibleMemberId: { type: ['string', 'null'], maxLength: 128 },
          notes: commonText,
        }
      : {
          requirementType: { type: 'string', minLength: 1, maxLength: 255 },
          subjectType: { type: ['string', 'null'], enum: ['SUBCONTRACTOR', 'PROJECT', 'ORGANIZATION', null] },
          subjectId: { type: ['string', 'null'], maxLength: 128 },
          responsibleMemberId: { type: ['string', 'null'], maxLength: 128 },
          effectiveDate: { type: ['string', 'null'], format: 'date' },
          expiryDate: { type: ['string', 'null'], format: 'date' },
          verificationRef: { type: ['string', 'null'], maxLength: 500 },
          notes: commonText,
          ...(update ? { status: { type: 'string', enum: ['ACTIVE'] } } : {}),
        };
  const required = entity === 'permit'
    ? ['permitType']
    : entity === 'inspection'
      ? ['inspectionType']
      : ['requirementType'];
  return {
    type: 'object',
    properties,
    ...(update ? { minProperties: 1 } : { required }),
  };
}

export const complianceRoutes: FastifyPluginAsync = async (fastify) => {
  for (const entity of Object.keys(schemaFor) as ComplianceEntityType[]) {
    const config = schemaFor[entity];
    const resourceParams = params(entity);
    const readCapability = `${config.cap}.read`;
    const manageCapability = `${config.cap}.manage`;
    const body = bodySchema(entity);

    fastify.post(
      `/:organizationId/projects/:projectId/${config.base}`,
      {
        schema: routeSchema(`Create ${entity}`, recordResult(entity), { body }),
        preHandler: [requireProjectPermission(manageCapability)],
      },
      createComplianceHandler(entity, config.create),
    );
    fastify.get(
      `/:organizationId/projects/:projectId/${config.base}`,
      {
        schema: routeSchema(`List ${entity}s`, {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object', additionalProperties: true } },
            nextCursor: { type: ['string', 'null'] },
          },
          required: ['data', 'nextCursor'],
        }, {
          querystring: {
            ...querySchema,
            properties: {
              ...querySchema.properties,
              status: { type: 'string', enum: listStatusEnums[entity] },
            },
          },
        }),
        preHandler: [requireProjectPermission(readCapability)],
      },
      listComplianceHandler(entity),
    );
    fastify.get(
      `/:organizationId/projects/:projectId/${config.base}/:${entity === 'permit' ? 'permitId' : entity === 'inspection' ? 'inspectionId' : 'recordId'}`,
      {
        schema: routeSchema(`Get ${entity}`, recordResult(entity), { entity }),
        preHandler: [requireProjectPermission(readCapability)],
      },
      getComplianceHandler(entity),
    );
    fastify.patch(
      `/:organizationId/projects/:projectId/${config.base}/:${entity === 'permit' ? 'permitId' : entity === 'inspection' ? 'inspectionId' : 'recordId'}`,
      {
        schema: routeSchema(`Update ${entity}`, recordResult(entity), {
          entity,
          body: bodySchema(entity, true),
        }),
        preHandler: [requireProjectPermission(manageCapability)],
      },
      updateComplianceHandler(entity, config.update),
    );
    fastify.delete(
      `/:organizationId/projects/:projectId/${config.base}/:${entity === 'permit' ? 'permitId' : entity === 'inspection' ? 'inspectionId' : 'recordId'}`,
      {
        schema: {
          tags: ['compliance'],
          summary: `Cancel ${entity}`,
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          params: resourceParams,
          response: { 204: { type: 'null' } },
        },
        preHandler: [requireProjectPermission(manageCapability)],
      },
      deleteComplianceHandler(entity),
    );
    fastify.post(
      `/:organizationId/projects/:projectId/${config.base}/:${entity === 'permit' ? 'permitId' : entity === 'inspection' ? 'inspectionId' : 'recordId'}/documents`,
      {
        schema: routeSchema(`Attach document to ${entity}`, {}, {
          entity,
          body: documentBody,
        }),
        preHandler: [requireProjectPermission(manageCapability)],
      },
      attachComplianceDocumentHandler(entity),
    );
  }

  fastify.post(
    '/:organizationId/projects/:projectId/permits/:permitId/transition',
    {
      schema: routeSchema('Transition permit status', recordResult('permit'), {
        entity: 'permit',
        body: permitTransitionBody,
      }),
      preHandler: [requireProjectPermission('project.permit.manage')],
    },
    transitionPermitHandler,
  );
  fastify.post(
    '/:organizationId/projects/:projectId/compliance-inspections/:inspectionId/complete',
    {
      schema: routeSchema('Complete a compliance inspection', recordResult('inspection'), {
        entity: 'inspection',
        body: completeInspectionBody,
      }),
      preHandler: [requireProjectPermission('project.compliance_inspection.manage')],
    },
    completeComplianceInspectionHandler,
  );
  fastify.post(
    '/:organizationId/projects/:projectId/compliance-records/:recordId/verify',
    {
      schema: routeSchema('Verify a compliance record', recordResult('record'), {
        entity: 'record',
        body: verifyBody,
      }),
      preHandler: [requireProjectPermission('project.compliance_record.manage')],
    },
    verifyComplianceRecordHandler,
  );

  fastify.get(
    '/:organizationId/projects/:projectId/expiring',
    {
      schema: routeSchema('List expiring project items', {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                entityType: { type: 'string', enum: ['document', 'permit', 'compliance_record'] },
                entityId: { type: 'string' },
                title: { type: 'string' },
                expiryDate: { type: 'string', format: 'date' },
                daysUntilExpiry: { type: 'integer' },
              },
              required: ['entityType', 'entityId', 'title', 'expiryDate', 'daysUntilExpiry'],
            },
          },
          total: { type: 'integer' },
        },
        required: ['items', 'total'],
      }, {
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 90, default: 30 },
            entityType: { type: 'string', enum: ['document', 'permit', 'compliance_record'] },
          },
        },
      }),
      preHandler: [requireProjectPermission('project.compliance_record.read')],
    },
    listExpiringItemsHandler,
  );
};
