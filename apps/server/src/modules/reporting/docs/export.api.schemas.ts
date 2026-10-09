// apps/server/src/modules/reporting/docs/export.api.schemas.ts
// OpenAPI / Swagger JSON Schema definitions for report export lifecycle endpoints.

const errorDetailSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    requestId: { type: 'string' },
  },
  required: ['code', 'message'],
} as const;

const apiErrorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: errorDetailSchema,
  },
  required: ['success', 'error'],
} as const;

const responses = {
  400: { description: 'Bad request', ...apiErrorSchema },
  401: { description: 'Unauthorized', ...apiErrorSchema },
  403: { description: 'Forbidden — Not member of organization', ...apiErrorSchema },
  404: { description: 'Export not found, expired, or unauthorized', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

const orgParams = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
  },
} as const;

const orgExportParams = {
  type: 'object',
  required: ['organizationId', 'exportId'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
    exportId: { type: 'string' },
  },
} as const;

export const requestExportSchemaDoc = {
  summary: 'Request Report Export',
  description: 'Initiates CSV export generation for a specified report family and filter scope. May respond synchronously or return async pending state.',
  tags: ['exports'],
  params: orgParams,
  body: {
    type: 'object',
    required: ['reportType'],
    properties: {
      projectId: { type: ['string', 'null'], format: 'uuid' },
      reportType: { type: 'string' },
      format: { type: 'string', enum: ['csv'], default: 'csv' },
      filters: { type: 'object', additionalProperties: true },
    },
  },
  response: {
    202: {
      description: 'Export request accepted / processed',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            exportId: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED'] },
            synchronous: { type: 'boolean' },
          },
          required: ['exportId', 'status', 'synchronous'],
        },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

const exportRecordSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: ['string', 'null'] },
    requestedBy: { type: 'string' },
    reportType: { type: 'string' },
    format: { type: 'string' },
    filterSnapshot: { type: 'object', additionalProperties: true },
    status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED'] },
    lastError: { type: ['string', 'null'] },
    expiresAt: { type: ['string', 'object'], format: 'date-time' },
    createdAt: { type: ['string', 'object'], format: 'date-time' },
    updatedAt: { type: ['string', 'object'], format: 'date-time' },
  },
  required: ['id', 'organizationId', 'reportType', 'format', 'status', 'expiresAt', 'createdAt'],
} as const;

export const listExportsSchemaDoc = {
  summary: 'List User Report Exports',
  description: 'Lists recent export records requested by the authenticated user in this organization.',
  tags: ['exports'],
  params: orgParams,
  response: {
    200: {
      description: 'List of exports retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'array',
          items: exportRecordSchema,
        },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

export const getExportStatusSchemaDoc = {
  summary: 'Get Export Status',
  description: 'Retrieves current status of an export request. Omit internal storage key.',
  tags: ['exports'],
  params: orgExportParams,
  response: {
    200: {
      description: 'Export status retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: exportRecordSchema,
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

export const getExportDownloadSchemaDoc = {
  summary: 'Get Export Presigned Download URL',
  description: 'Reauthorizes access and generates a fresh 5-minute presigned download URL for a ready export.',
  tags: ['exports'],
  params: orgExportParams,
  response: {
    200: {
      description: 'Fresh download URL generated',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            downloadUrl: { type: 'string', format: 'uri' },
          },
          required: ['downloadUrl'],
        },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;
