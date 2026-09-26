// apps/server/src/modules/organization/docs/organization.schemas.ts
// OpenAPI / Swagger JSON-Schema definitions for the organization module.

const errorDetailSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', example: 'FORBIDDEN' },
    message: { type: 'string', example: 'Access denied' },
    requestId: { type: 'string', example: 'uuid-request-id' },
  },
  required: ['code', 'message'],
} as const;

const apiErrorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false], example: false },
    error: errorDetailSchema,
  },
  required: ['success', 'error'],
} as const;

const organizationSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    name: { type: 'string', example: 'Acme Construction' },
    slug: { type: 'string', example: 'acme-construction' },
    status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'], example: 'ACTIVE' },
    createdBy: { type: 'string', example: 'usr_01J9Z0F8QPXKMPQ1VRFP1D5K3B' },
    createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
    updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
  },
  required: ['id', 'name', 'slug', 'status', 'createdBy', 'createdAt', 'updatedAt'],
} as const;

const metaSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'string', format: 'date-time' },
    requestId: { type: 'string' },
    page: { type: 'number' },
    limit: { type: 'number' },
    total: { type: 'number' },
  },
  additionalProperties: true,
} as const;

const responses = {
  400: { description: 'Bad request', ...apiErrorSchema },
  401: { description: 'Unauthorized', ...apiErrorSchema },
  403: { description: 'Forbidden', ...apiErrorSchema },
  404: { description: 'Not found', ...apiErrorSchema },
  409: { description: 'Conflict (e.g. slug already taken)', ...apiErrorSchema },
  422: { description: 'Validation error', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

export const createOrgSchemaDoc = {
  tags: ['organizations'],
  summary: 'Create a new organization',
  description: 'Creates a new organization, seeds 7 system roles and permissions, empty profile, default settings, 7 document sequences, and assigns creator as Organization Admin.',
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100, example: 'Acme Construction' },
      slug: {
        type: 'string',
        minLength: 2,
        maxLength: 50,
        pattern: '^[a-z0-9-]+$',
        example: 'acme-construction',
        description: 'Optional. If omitted, derived from name automatically.',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { organization: organizationSchema },
          required: ['organization'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    409: responses[409],
    422: responses[422],
    500: responses[500],
  },
};

export const listOrgsSchemaDoc = {
  tags: ['organizations'],
  summary: 'List user organizations',
  description: 'Returns all active organizations where the authenticated user is a member.',
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: {
            organizations: {
              type: 'array',
              items: organizationSchema,
            },
          },
          required: ['organizations'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    500: responses[500],
  },
};

export const getOrgSchemaDoc = {
  tags: ['organizations'],
  summary: 'Get organization details by ID',
  description: 'Returns organization details for a specified organization ID if the user has valid membership.',
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { organization: organizationSchema },
          required: ['organization'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    404: responses[404],
    500: responses[500],
  },
};

export const updateOrgSchemaDoc = {
  tags: ['organizations'],
  summary: 'Update organization details',
  description: 'Updates organization name. Requires organization:update permission.',
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100, example: 'Acme Global Construction' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { organization: organizationSchema },
          required: ['organization'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    404: responses[404],
    422: responses[422],
    500: responses[500],
  },
};
