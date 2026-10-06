import type { FastifyPluginAsync, FastifySchema } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleCompleteDocumentUpload,
  handleCompleteDocumentVersion,
  handleDeleteDocument,
  handleGetDocument,
  handleGetDocumentDownload,
  handleInitiateDocumentUpload,
  handleInitiateDocumentVersion,
  handleListDocumentVersions,
  handleListDocuments,
  handleUpdateDocument,
} from './document.handler.js';

const projectParams = {
  type: 'object',
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
  },
  required: ['organizationId', 'projectId'],
};

const documentParams = {
  type: 'object',
  properties: {
    ...projectParams.properties,
    documentId: { type: 'string' },
  },
  required: ['organizationId', 'projectId', 'documentId'],
};

const documentVersionParams = {
  type: 'object',
  properties: {
    ...documentParams.properties,
    versionId: { type: 'string' },
  },
  required: ['organizationId', 'projectId', 'documentId', 'versionId'],
};

const documentCategories = [
  'DRAWING',
  'SPECIFICATION',
  'PERMIT',
  'CERTIFICATE',
  'REPORT',
  'PHOTO',
  'VIDEO',
  'CONTRACT',
  'INVOICE',
  'OTHER',
] as const;
const documentStatuses = ['PENDING_UPLOAD', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED', 'DELETED'] as const;
const documentProcessingStatuses = ['NOT_STARTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
const documentAccessPolicies = ['PROJECT_MEMBERS', 'PROJECT_MANAGERS_ONLY', 'ADMIN_ONLY'] as const;

const documentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    category: { type: 'string', enum: documentCategories },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    status: { type: 'string', enum: documentStatuses },
    processingStatus: { type: 'string', enum: documentProcessingStatuses },
    currentVersion: { type: 'integer' },
    uploadedBy: { type: ['string', 'null'] },
    fileName: { type: 'string' },
    fileSize: { type: 'integer' },
    contentType: { type: 'string' },
    checksum: { type: ['string', 'null'] },
    accessPolicy: { type: 'string', enum: documentAccessPolicies },
    expiryDate: { type: ['string', 'null'] },
    expiresNotified: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: [
    'id',
    'organizationId',
    'projectId',
    'category',
    'title',
    'description',
    'status',
    'processingStatus',
    'currentVersion',
    'uploadedBy',
    'fileName',
    'fileSize',
    'contentType',
    'checksum',
    'accessPolicy',
    'expiryDate',
    'expiresNotified',
    'createdAt',
    'updatedAt',
  ],
};

const versionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    documentId: { type: 'string' },
    versionNumber: { type: 'integer' },
    uploadedBy: { type: ['string', 'null'] },
    fileName: { type: 'string' },
    fileSize: { type: 'integer' },
    contentType: { type: 'string' },
    checksum: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
  },
  required: [
    'id',
    'documentId',
    'versionNumber',
    'uploadedBy',
    'fileName',
    'fileSize',
    'contentType',
    'checksum',
    'notes',
    'createdAt',
  ],
};

function successResponse(data: object) {
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

const authSecurity: FastifySchema['security'] = [{ bearerAuth: [] }, { cookieAuth: [] }];

function routeSchema(
  summary: string,
  params: object,
  data: object,
  body?: object,
  querystring?: object,
): FastifySchema {
  return {
    tags: ['documents'],
    summary,
    security: authSecurity,
    params,
    ...(body ? { body } : {}),
    ...(querystring ? { querystring } : {}),
    response: { 200: successResponse(data), 201: successResponse(data) },
  };
}

const documentResult = {
  type: 'object',
  properties: { document: documentSchema },
  required: ['document'],
};

const uploadBody = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 500 },
    category: { type: 'string', enum: documentCategories },
    fileName: { type: 'string', minLength: 1, maxLength: 255 },
    contentType: { type: 'string', minLength: 3, maxLength: 255, pattern: '^[\\w.+-]+/[\\w.+-]+$' },
    fileSize: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    description: { type: 'string', maxLength: 10000 },
    accessPolicy: { type: 'string', enum: documentAccessPolicies },
    expiryDate: { type: 'string', format: 'date' },
  },
  required: ['title', 'category', 'fileName', 'contentType', 'fileSize'],
};

const completeBody = {
  type: 'object',
  properties: { checksum: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' } },
  required: ['checksum'],
};

const versionBody = {
  type: 'object',
  properties: {
    fileName: { type: 'string', minLength: 1, maxLength: 255 },
    contentType: { type: 'string', minLength: 3, maxLength: 255, pattern: '^[\\w.+-]+/[\\w.+-]+$' },
    fileSize: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    notes: { type: 'string', maxLength: 10000 },
  },
  required: ['fileName', 'contentType', 'fileSize'],
};

export const documentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/:organizationId/projects/:projectId/documents',
    {
      schema: routeSchema(
        'Initiate a document upload',
        projectParams,
        {
          type: 'object',
          properties: { document: documentSchema, uploadUrl: { type: 'string', format: 'uri' } },
          required: ['document', 'uploadUrl'],
        },
        uploadBody,
      ),
      preHandler: [requireProjectPermission('project.document.upload')],
    },
    handleInitiateDocumentUpload,
  );

  fastify.post(
    '/:organizationId/projects/:projectId/documents/:documentId/complete',
    {
      schema: routeSchema('Complete a document upload', documentParams, documentResult, completeBody),
      preHandler: [requireProjectPermission('project.document.upload')],
    },
    handleCompleteDocumentUpload,
  );

  fastify.get(
    '/:organizationId/projects/:projectId/documents',
    {
      schema: routeSchema(
        'List project documents',
        projectParams,
        {
          type: 'object',
          properties: {
            data: { type: 'array', items: documentSchema },
            nextCursor: { type: ['string', 'null'] },
          },
          required: ['data', 'nextCursor'],
        },
        undefined,
        {
          type: 'object',
          properties: {
            cursor: { type: 'string', maxLength: 512 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
            category: { type: 'string', enum: documentCategories },
            status: { type: 'string', enum: documentStatuses },
          },
        },
      ),
      preHandler: [requireProjectPermission('project.document.download')],
    },
    handleListDocuments,
  );

  fastify.get(
    '/:organizationId/projects/:projectId/documents/:documentId',
    {
      schema: routeSchema('Get a project document', documentParams, documentResult),
      preHandler: [requireProjectPermission('project.document.download')],
    },
    handleGetDocument,
  );

  fastify.get(
    '/:organizationId/projects/:projectId/documents/:documentId/download',
    {
      schema: routeSchema(
        'Get a presigned document download URL',
        documentParams,
        {
          type: 'object',
          properties: { downloadUrl: { type: 'string', format: 'uri' }, expiresIn: { type: 'integer' } },
          required: ['downloadUrl', 'expiresIn'],
        },
      ),
      preHandler: [requireProjectPermission('project.document.download')],
    },
    handleGetDocumentDownload,
  );

  fastify.patch(
    '/:organizationId/projects/:projectId/documents/:documentId',
    {
      schema: routeSchema(
        'Update document metadata',
        documentParams,
        documentResult,
        {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 500 },
            description: { type: ['string', 'null'], maxLength: 10000 },
            accessPolicy: { type: 'string', enum: documentAccessPolicies },
            expiryDate: { type: ['string', 'null'], format: 'date' },
          },
          minProperties: 1,
        },
      ),
      preHandler: [requireProjectPermission('project.document.manage')],
    },
    handleUpdateDocument,
  );

  fastify.delete(
    '/:organizationId/projects/:projectId/documents/:documentId',
    {
      schema: {
        tags: ['documents'],
        summary: 'Soft-delete a project document',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        params: documentParams,
        response: { 204: { type: 'null' } },
      },
      preHandler: [requireProjectPermission('project.document.manage')],
    },
    handleDeleteDocument,
  );

  fastify.post(
    '/:organizationId/projects/:projectId/documents/:documentId/versions',
    {
      schema: routeSchema(
        'Initiate a new document version',
        documentParams,
        {
          type: 'object',
          properties: { version: versionSchema, uploadUrl: { type: 'string', format: 'uri' } },
          required: ['version', 'uploadUrl'],
        },
        versionBody,
      ),
      preHandler: [requireProjectPermission('project.document.version')],
    },
    handleInitiateDocumentVersion,
  );

  fastify.post(
    '/:organizationId/projects/:projectId/documents/:documentId/versions/:versionId/complete',
    {
      schema: routeSchema(
        'Complete a document version upload',
        documentVersionParams,
        {
          type: 'object',
          properties: { version: versionSchema, document: documentSchema },
          required: ['version', 'document'],
        },
        completeBody,
      ),
      preHandler: [requireProjectPermission('project.document.version')],
    },
    handleCompleteDocumentVersion,
  );

  fastify.get(
    '/:organizationId/projects/:projectId/documents/:documentId/versions',
    {
      schema: routeSchema(
        'List document versions',
        documentParams,
        { type: 'object', properties: { versions: { type: 'array', items: versionSchema } }, required: ['versions'] },
      ),
      preHandler: [requireProjectPermission('project.document.download')],
    },
    handleListDocumentVersions,
  );
};
