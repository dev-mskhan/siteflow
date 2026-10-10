// apps/server/src/modules/reporting/docs/report.api.schemas.ts
// OpenAPI / Swagger JSON Schema definitions for reporting endpoints.

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
  403: { description: 'Forbidden — Not member or missing project permission', ...apiErrorSchema },
  404: { description: 'Report data or project not found', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

const orgProjectParams = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
    projectId: { type: 'string', format: 'uuid' },
  },
} as const;

const orgParams = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', format: 'uuid' },
  },
} as const;

const reportFilterQuery = {
  type: 'object',
  properties: {
    datePreset: {
      type: 'string',
      enum: ['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_30_DAYS', 'THIS_QUARTER', 'THIS_YEAR', 'CUSTOM'],
    },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    asOfDate: { type: 'string', format: 'date' },
  },
} as const;

export const getHealthReportSchemaDoc = {
  summary: 'Get Project Health Report',
  description: 'Retrieves multi-indicator project health composed from authoritative schedule, issues, RFIs, and tasks.',
  tags: ['reporting'],
  params: orgProjectParams,
  response: {
    200: {
      description: 'Project health report retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
        meta: { type: 'object' },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

export const getScheduleReportSchemaDoc = {
  summary: 'Get Schedule Variance and Progress Report',
  description: 'Retrieves schedule variance, task progress, and milestone status against the active baseline.',
  tags: ['reporting'],
  params: orgProjectParams,
  querystring: reportFilterQuery,
  response: {
    200: {
      description: 'Schedule report retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
        meta: { type: 'object' },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

export const getCostReportSchemaDoc = {
  summary: 'Get Commercial Financial Summary Report',
  description: 'Retrieves budget, committed costs, spent to date, and forecast summary for the project.',
  tags: ['reporting'],
  params: orgProjectParams,
  querystring: reportFilterQuery,
  response: {
    200: {
      description: 'Cost report retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
        meta: { type: 'object' },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

export const getProcurementReportSchemaDoc = {
  summary: 'Get Procurement Report',
  description: 'Retrieves material requests, purchase orders, delivery status, and procurement fulfillment rates.',
  tags: ['reporting'],
  params: orgProjectParams,
  querystring: reportFilterQuery,
  response: {
    200: {
      description: 'Procurement report retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
        meta: { type: 'object' },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

export const getSubcontractorReportSchemaDoc = {
  summary: 'Get Subcontractor Performance Report',
  description: 'Retrieves subcontractor contract values, assigned tasks, and quality/safety performance metrics.',
  tags: ['reporting'],
  params: orgProjectParams,
  querystring: reportFilterQuery,
  response: {
    200: {
      description: 'Subcontractor report retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
        meta: { type: 'object' },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

export const getExecutiveSummaryReportSchemaDoc = {
  summary: 'Get Project Executive Summary Report',
  description: 'Composes health, schedule, cost, and procurement highlights into a high-level executive briefing.',
  tags: ['reporting'],
  params: orgProjectParams,
  querystring: reportFilterQuery,
  response: {
    200: {
      description: 'Executive summary report retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
        meta: { type: 'object' },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;

export const getPortfolioReportSchemaDoc = {
  summary: 'Get Organization Portfolio Report',
  description: 'Aggregates multi-project health, status, and contract values grouped by currency for the organization.',
  tags: ['reporting'],
  params: orgParams,
  querystring: {
    ...reportFilterQuery,
    properties: {
      ...reportFilterQuery.properties,
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      cursor: { type: 'string', minLength: 1, maxLength: 512 },
    },
  },
  response: {
    200: {
      description: 'Portfolio report retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
        meta: { type: 'object' },
      },
      required: ['success', 'data'],
    },
    ...responses,
  },
} as const;
