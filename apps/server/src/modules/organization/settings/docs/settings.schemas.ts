// apps/server/src/modules/organization/settings/docs/settings.schemas.ts

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

const settingsSchema = {
  type: 'object',
  properties: {
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    timezone: { type: 'string', example: 'UTC' },
    currency: { type: 'string', example: 'USD', minLength: 3, maxLength: 3 },
    locale: { type: 'string', example: 'en-US' },
    dateFormat: {
      type: 'string',
      enum: ['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD'],
      example: 'YYYY_MM_DD',
    },
    timeFormat: { type: 'string', enum: ['H12', 'H24'], example: 'H24' },
    unitSystem: { type: 'string', enum: ['METRIC', 'IMPERIAL'], example: 'METRIC' },
    weekStartsOn: { type: 'integer', minimum: 0, maximum: 6, example: 1 },
    fiscalYearStartMonth: { type: 'integer', minimum: 1, maximum: 12, example: 1 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'organizationId',
    'timezone',
    'currency',
    'locale',
    'dateFormat',
    'timeFormat',
    'unitSystem',
    'weekStartsOn',
    'fiscalYearStartMonth',
    'createdAt',
    'updatedAt',
  ],
} as const;

const paramsSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
  },
} as const;

export const getSettingsSchemaDoc = {
  tags: ['settings'],
  summary: 'Get organization settings',
  description: 'Returns organization settings. Requires settings:read permission.',
  params: paramsSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { settings: settingsSchema },
          required: ['settings'],
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

export const updateSettingsSchemaDoc = {
  tags: ['settings'],
  summary: 'Update organization settings',
  description: 'Partially updates organization settings. Validates timezone (IANA), currency (3-letter ISO), weekStartsOn (0-6), fiscalYearStartMonth (1-12). Requires settings:update permission.',
  params: paramsSchema,
  body: {
    type: 'object',
    properties: {
      timezone: { type: 'string', example: 'America/New_York' },
      currency: { type: 'string', minLength: 3, maxLength: 3, example: 'EUR' },
      locale: { type: 'string', example: 'en-GB' },
      dateFormat: { type: 'string', enum: ['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD'] },
      timeFormat: { type: 'string', enum: ['H12', 'H24'] },
      unitSystem: { type: 'string', enum: ['METRIC', 'IMPERIAL'] },
      weekStartsOn: { type: 'integer', minimum: 0, maximum: 6 },
      fiscalYearStartMonth: { type: 'integer', minimum: 1, maximum: 12 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { settings: settingsSchema },
          required: ['settings'],
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
