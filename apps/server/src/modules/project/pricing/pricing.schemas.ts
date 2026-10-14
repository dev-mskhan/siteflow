const pathParams = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
    rateId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  additionalProperties: false,
} as const;

const rateIdParam = {
  ...pathParams,
  required: ['organizationId', 'projectId', 'rateId'],
} as const;

const errorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
      required: ['code', 'message'],
    },
  },
  required: ['success', 'error'],
} as const;

const successEnvelope = (data: Record<string, unknown>) =>
  ({
    type: 'object',
    properties: { success: { type: 'boolean', enum: [true] }, data: { type: 'object', properties: data } },
    required: ['success', 'data'],
  }) as const;

const rateVersionDto = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    materialId: { type: 'string' },
    scope: { type: 'string', enum: ['ORGANIZATION', 'PROJECT'] },
    projectId: { type: ['string', 'null'] },
    versionNumber: { type: 'integer' },
    unitCode: { type: 'string' },
    unitPrice: { type: 'string', description: 'Decimal string with up to 4 fraction digits.' },
    currencyCode: { type: 'string' },
    effectiveFrom: { type: 'string', format: 'date' },
    effectiveTo: { type: ['string', 'null'], format: 'date' },
    status: { type: 'string', enum: ['DRAFT', 'APPROVED', 'RETIRED'] },
    createdBy: { type: 'string' },
    approvedBy: { type: ['string', 'null'] },
    approvedAt: { type: ['string', 'null'] },
    retiredAt: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'organizationId', 'materialId', 'scope', 'versionNumber', 'unitPrice', 'status'],
} as const;

const resolvedRateDto = {
  type: 'object',
  properties: {
    source: { type: 'string', enum: ['ACCEPTED_QUOTE', 'PROJECT_RATE', 'ORGANIZATION_RATE'] },
    unitPrice: { type: 'string' },
    unitCode: { type: 'string' },
    currencyCode: { type: 'string' },
    quoteId: { type: 'string' },
    quoteItemId: { type: 'string' },
    rateVersion: rateVersionDto,
  },
  required: ['source', 'unitPrice', 'unitCode', 'currencyCode'],
} as const;

const versionBody = {
  type: 'object',
  required: ['materialId', 'scope', 'unitCode', 'unitPrice', 'currencyCode', 'effectiveFrom'],
  properties: {
    materialId: { type: 'string', minLength: 1, maxLength: 128 },
    scope: { type: 'string', enum: ['ORGANIZATION', 'PROJECT'] },
    projectId: { type: ['string', 'null'], maxLength: 128 },
    unitCode: { type: 'string', minLength: 1, maxLength: 32 },
    unitPrice: { type: 'string', pattern: '^\\d{1,11}(?:\\.\\d{1,4})?$' },
    currencyCode: { type: 'string', pattern: '^[A-Z]{3}$' },
    effectiveFrom: { type: 'string', format: 'date' },
    effectiveTo: { type: ['string', 'null'], format: 'date' },
  },
  additionalProperties: false,
} as const;

const errorResponses = {
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  409: errorSchema,
} as const;

export const pricingRouteDocs = {
  create: {
    tags: ['Pricing'],
    summary: 'Create a draft material rate version',
    params: pathParams,
    body: versionBody,
    response: {
      201: successEnvelope({ rateVersion: rateVersionDto }),
      ...errorResponses,
    },
  },
  list: {
    tags: ['Pricing'],
    summary: 'List rate versions for a material',
    params: pathParams,
    querystring: {
      type: 'object',
      required: ['materialId'],
      properties: { materialId: { type: 'string', minLength: 1, maxLength: 128 } },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({ rateVersions: { type: 'array', items: rateVersionDto } }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
    },
  },
  get: {
    tags: ['Pricing'],
    summary: 'Get a material rate version',
    params: rateIdParam,
    response: {
      200: successEnvelope({ rateVersion: rateVersionDto }),
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
    },
  },
  approve: {
    tags: ['Pricing'],
    summary: 'Approve a draft rate version',
    params: rateIdParam,
    response: {
      200: successEnvelope({ rateVersion: rateVersionDto }),
      ...errorResponses,
    },
  },
  retire: {
    tags: ['Pricing'],
    summary: 'Retire an approved rate version from an effective date',
    params: rateIdParam,
    body: {
      type: 'object',
      required: ['effectiveTo'],
      properties: { effectiveTo: { type: 'string', format: 'date' } },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({ rateVersion: rateVersionDto }),
      ...errorResponses,
    },
  },
  resolve: {
    tags: ['Pricing'],
    summary: 'Resolve the effective material rate for a project and date',
    params: pathParams,
    querystring: {
      type: 'object',
      required: ['materialId', 'asOf'],
      properties: {
        materialId: { type: 'string', minLength: 1, maxLength: 128 },
        asOf: { type: 'string', format: 'date' },
      },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({ resolved: resolvedRateDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
    },
  },
} as const;
