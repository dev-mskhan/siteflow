// apps/server/src/modules/material/docs/material.api.schemas.ts
// Fastify JSON Schema definitions for OpenAPI/Swagger documentation for the Material catalog module.

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
  409: { description: 'Conflict', ...apiErrorSchema },
  422: { description: 'Validation error', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

const orgParams = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string' },
  },
} as const;

const orgMaterialParams = {
  type: 'object',
  required: ['organizationId', 'materialId'],
  properties: {
    organizationId: { type: 'string' },
    materialId: { type: 'string' },
  },
} as const;

// ── DTO Schemas ───────────────────────────────────────────────────────────────

const materialDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    materialCode: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    category: { type: ['string', 'null'] },
    defaultUnitCode: { type: 'string' },
    materialType: {
      type: ['string', 'null'],
      enum: ['MATERIAL', 'EQUIPMENT', 'CONSUMABLE', 'SERVICE', 'OTHER', null],
    },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    defaultTaxCode: { type: ['string', 'null'] },
    defaultCurrencyCode: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'materialCode', 'name', 'defaultUnitCode', 'status', 'createdAt', 'updatedAt'],
} as const;

const materialSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: materialDTOSchema,
    meta: {
      type: 'object',
      properties: { timestamp: { type: 'string' } },
    },
  },
  required: ['success', 'data'],
} as const;

const materialListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: { type: 'array', items: materialDTOSchema },
    meta: {
      type: 'object',
      properties: {
        timestamp: { type: 'string' },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
  required: ['success', 'data'],
} as const;

// ── Route schemas ─────────────────────────────────────────────────────────────

export const listMaterialsSchemaDoc = {
  tags: ['materials'],
  summary: 'List materials in organization catalog',
  security: [{ bearerAuth: [] }],
  params: orgParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
      category: { type: 'string' },
    },
  },
  response: {
    200: materialListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const createMaterialSchemaDoc = {
  tags: ['materials'],
  summary: 'Create a new material in the catalog',
  security: [{ bearerAuth: [] }],
  params: orgParams,
  body: {
    type: 'object',
    required: ['materialCode', 'name', 'defaultUnitCode'],
    properties: {
      materialCode: { type: 'string', minLength: 1, maxLength: 100 },
      name: { type: 'string', minLength: 1, maxLength: 500 },
      description: { type: 'string', maxLength: 2000 },
      category: { type: 'string', maxLength: 200 },
      defaultUnitCode: { type: 'string', minLength: 1, maxLength: 20 },
      materialType: { type: 'string', enum: ['MATERIAL', 'EQUIPMENT', 'CONSUMABLE', 'SERVICE', 'OTHER'] },
      defaultTaxCode: { type: 'string', maxLength: 50 },
      defaultCurrencyCode: { type: 'string', minLength: 3, maxLength: 3 },
    },
  },
  response: {
    201: materialSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    409: responses[409], 422: responses[422], 500: responses[500],
  },
};

export const getMaterialSchemaDoc = {
  tags: ['materials'],
  summary: 'Get a material by ID',
  security: [{ bearerAuth: [] }],
  params: orgMaterialParams,
  response: {
    200: materialSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateMaterialSchemaDoc = {
  tags: ['materials'],
  summary: 'Update a material in the catalog',
  security: [{ bearerAuth: [] }],
  params: orgMaterialParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 500 },
      description: { type: 'string', maxLength: 2000 },
      category: { type: 'string', maxLength: 200 },
      defaultUnitCode: { type: 'string', minLength: 1, maxLength: 20 },
      materialType: { type: 'string', enum: ['MATERIAL', 'EQUIPMENT', 'CONSUMABLE', 'SERVICE', 'OTHER'] },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
      defaultTaxCode: { type: 'string', maxLength: 50 },
      defaultCurrencyCode: { type: 'string', minLength: 3, maxLength: 3 },
    },
  },
  response: {
    200: materialSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};
