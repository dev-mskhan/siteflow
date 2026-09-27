// apps/server/src/modules/project/docs/project.api.schemas.ts
// Fastify JSON Schema definitions for OpenAPI/serialization.

const metaSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'string', format: 'date-time' },
    requestId: { type: 'string' },
  },
  additionalProperties: true,
} as const;

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
  403: { description: 'Forbidden', ...apiErrorSchema },
  404: { description: 'Not found', ...apiErrorSchema },
  409: { description: 'Conflict / optimistic lock failure', ...apiErrorSchema },
  422: { description: 'Validation / invalid transition error', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

export const projectDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectNumber: { type: 'string', example: 'PRJ-0001' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
    },
    projectType: {
      type: ['string', 'null'],
      enum: ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER', null],
    },
    contractValue: { type: ['string', 'null'] },
    currency: { type: 'string', example: 'USD' },
    plannedStartDate: { type: ['string', 'null'] },
    plannedEndDate: { type: ['string', 'null'] },
    actualStartDate: { type: ['string', 'null'] },
    actualEndDate: { type: ['string', 'null'] },
    createdBy: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id', 'organizationId', 'projectNumber', 'name', 'status',
    'currency', 'createdAt', 'updatedAt',
  ],
} as const;

const projectSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { project: projectDTOSchema },
      required: ['project'],
    },
    meta: metaSchema,
  },
  required: ['success', 'data'],
} as const;

const projectListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        projects: { type: 'array', items: projectDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['projects', 'nextCursor'],
    },
    meta: metaSchema,
  },
  required: ['success', 'data'],
} as const;

// ── Route schemas ─────────────────────────────────────────────────────────────

export const createProjectSchemaDoc = {
  tags: ['projects'],
  summary: 'Create a new project',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: { organizationId: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
      projectType: { type: 'string', enum: ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER'] },
      contractValue: { type: 'string' },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      plannedStartDate: { type: 'string', format: 'date' },
      plannedEndDate: { type: 'string', format: 'date' },
    },
  },
  response: {
    201: projectSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    422: responses[422], 500: responses[500],
  },
};

export const listProjectsSchemaDoc = {
  tags: ['projects'],
  summary: 'List projects in an organization',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: { organizationId: { type: 'string' } },
  },
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'] },
      search: { type: 'string' },
    },
  },
  response: {
    200: projectListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const getProjectSchemaDoc = {
  tags: ['projects'],
  summary: 'Get a project by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  response: {
    200: projectSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateProjectSchemaDoc = {
  tags: ['projects'],
  summary: 'Update project metadata',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['expectedVersion'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: ['string', 'null'] },
      projectType: { type: ['string', 'null'], enum: ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER', null] },
      contractValue: { type: ['string', 'null'] },
      plannedStartDate: { type: ['string', 'null'], format: 'date' },
      plannedEndDate: { type: ['string', 'null'], format: 'date' },
      expectedVersion: { type: 'integer', minimum: 1 },
    },
  },
  response: {
    200: projectSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 409: responses[409], 422: responses[422], 500: responses[500],
  },
};

export const lifecycleSchemaDoc = {
  tags: ['projects'],
  summary: 'Transition project lifecycle status',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  response: {
    200: projectSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};
