// apps/server/src/modules/organization/sequences/docs/sequences.schemas.ts

const apiErrorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
      },
      required: ['code', 'message'],
    },
  },
  required: ['success', 'error'],
} as const;

const SEQUENCE_TYPES = [
  'PROJECT',
  'ESTIMATE',
  'INVOICE',
  'PURCHASE_ORDER',
  'CHANGE_ORDER',
  'RFI',
  'SUBMITTAL',
] as const;

const sequenceSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'uuid-here' },
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    type: { type: 'string', enum: SEQUENCE_TYPES, example: 'PROJECT' },
    prefix: { type: 'string', example: 'PRJ' },
    padding: { type: 'integer', minimum: 1, maximum: 10, example: 4 },
    nextValue: { type: 'integer', minimum: 1, example: 1 },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'type', 'prefix', 'padding', 'nextValue', 'updatedAt'],
} as const;

const paramsSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
  },
} as const;

const paramsWithTypeSchema = {
  type: 'object',
  required: ['organizationId', 'type'],
  properties: {
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    type: { type: 'string', example: 'PROJECT' },
  },
} as const;

export const listSequencesSchemaDoc = {
  tags: ['document-sequences'],
  summary: 'List document sequences',
  description: 'Returns all document sequences for the organization. Requires settings:read permission.',
  params: paramsSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            sequences: { type: 'array', items: sequenceSchema },
          },
          required: ['sequences'],
        },
      },
      required: ['success', 'data'],
    },
    401: { description: 'Unauthorized', ...apiErrorSchema },
    403: { description: 'Forbidden', ...apiErrorSchema },
    500: { description: 'Internal server error', ...apiErrorSchema },
  },
};

export const getSequenceSchemaDoc = {
  tags: ['document-sequences'],
  summary: 'Get a document sequence',
  description: 'Returns a single document sequence by type. Requires settings:read permission.',
  params: paramsWithTypeSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { sequence: sequenceSchema },
          required: ['sequence'],
        },
      },
      required: ['success', 'data'],
    },
    401: { description: 'Unauthorized', ...apiErrorSchema },
    403: { description: 'Forbidden', ...apiErrorSchema },
    404: { description: 'Not found', ...apiErrorSchema },
    500: { description: 'Internal server error', ...apiErrorSchema },
  },
};

export const updateSequenceSchemaDoc = {
  tags: ['document-sequences'],
  summary: 'Update document sequence config',
  description: 'Updates the prefix and/or padding for a document sequence. nextValue cannot be modified via API. Requires settings:update permission.',
  params: paramsWithTypeSchema,
  body: {
    type: 'object',
    properties: {
      prefix: { type: 'string', minLength: 1, maxLength: 10, example: 'P' },
      padding: { type: 'integer', minimum: 1, maximum: 10, example: 5 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { sequence: sequenceSchema },
          required: ['sequence'],
        },
      },
      required: ['success', 'data'],
    },
    401: { description: 'Unauthorized', ...apiErrorSchema },
    403: { description: 'Forbidden', ...apiErrorSchema },
    404: { description: 'Not found', ...apiErrorSchema },
    422: { description: 'Validation error', ...apiErrorSchema },
    500: { description: 'Internal server error', ...apiErrorSchema },
  },
};
