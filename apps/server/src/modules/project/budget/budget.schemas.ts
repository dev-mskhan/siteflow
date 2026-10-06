const pathParams = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
    budgetId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  additionalProperties: false,
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

const budgetLineDto = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    lineNumber: { type: 'integer' },
    costCodeId: { type: 'string' },
    phaseId: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    amount: { type: 'string' },
  },
  required: ['id', 'lineNumber', 'costCodeId', 'phaseId', 'description', 'amount'],
} as const;

const budgetDto = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    currencyCode: { type: 'string' },
    status: { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED', 'CLOSED'] },
    version: { type: 'integer' },
    currentRevisionNumber: { type: 'integer' },
    createdBy: { type: 'string' },
    submittedBy: { type: ['string', 'null'] },
    submittedAt: { type: ['string', 'null'] },
    approvedBy: { type: ['string', 'null'] },
    approvedAt: { type: ['string', 'null'] },
    closedAt: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    revision: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        revisionNumber: { type: 'integer' },
        status: { type: 'string' },
        createdBy: { type: 'string' },
        submittedBy: { type: ['string', 'null'] },
        submittedAt: { type: ['string', 'null'] },
        approvedBy: { type: ['string', 'null'] },
        approvedAt: { type: ['string', 'null'] },
      },
      required: ['id', 'revisionNumber', 'status', 'createdBy', 'submittedBy', 'submittedAt', 'approvedBy', 'approvedAt'],
    },
    lines: { type: 'array', items: budgetLineDto },
    total: { type: 'string' },
  },
  required: [
    'id', 'organizationId', 'projectId', 'currencyCode', 'status', 'version',
    'currentRevisionNumber', 'createdBy', 'submittedBy', 'submittedAt',
    'approvedBy', 'approvedAt', 'closedAt', 'createdAt', 'updatedAt',
    'revision', 'lines', 'total',
  ],
} as const;

const success = (data: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data,
    meta: { type: 'object', additionalProperties: true },
  },
  required: ['success', 'data'],
});

const errors = {
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  409: errorSchema,
  422: errorSchema,
  500: errorSchema,
} as const;

const base = {
  tags: ['commercial budgets'],
  security: [{ bearerAuth: [] }],
  params: pathParams,
} as const;

export const budgetRouteDocs = {
  create: {
    ...base,
    summary: 'Create a draft project budget',
    body: {
      type: 'object',
      required: ['currencyCode', 'lines'],
      properties: {
        currencyCode: { type: 'string', pattern: '^[A-Za-z]{3}$' },
        lines: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: {
            type: 'object',
            required: ['costCodeId', 'amount'],
            properties: {
              costCodeId: { type: 'string', minLength: 1, maxLength: 128 },
              phaseId: { type: 'string', minLength: 1, maxLength: 128 },
              description: { type: 'string', maxLength: 500 },
              amount: { type: 'string', pattern: '^\\d{1,13}(?:\\.\\d{1,2})?$' },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    response: {
      201: success({ type: 'object', properties: { budget: budgetDto }, required: ['budget'] }),
      ...errors,
    },
  },
  list: {
    ...base,
    summary: 'List the project budget',
    querystring: {
      type: 'object',
      properties: {
        cursor: { type: 'string', maxLength: 512 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
    response: {
      200: success({
        type: 'object',
        properties: {
          budgets: { type: 'array', items: budgetDto },
          nextCursor: { type: ['string', 'null'] },
        },
        required: ['budgets', 'nextCursor'],
      }),
      401: errors[401],
      403: errors[403],
      500: errors[500],
    },
  },
  get: {
    ...base,
    summary: 'Get a project budget',
    response: { 200: success({ type: 'object', properties: { budget: budgetDto }, required: ['budget'] }), ...errors },
  },
  update: {
    ...base,
    summary: 'Update a draft or create a new draft revision',
    body: {
      type: 'object',
      required: ['expectedVersion', 'lines'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1 },
        lines: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: {
            type: 'object',
            required: ['costCodeId', 'amount'],
            properties: {
              costCodeId: { type: 'string', minLength: 1, maxLength: 128 },
              phaseId: { type: 'string', minLength: 1, maxLength: 128 },
              description: { type: 'string', maxLength: 500 },
              amount: { type: 'string', pattern: '^\\d{1,13}(?:\\.\\d{1,2})?$' },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    response: {
      200: success({ type: 'object', properties: { budget: budgetDto }, required: ['budget'] }),
      ...errors,
    },
  },
  transition: {
    ...base,
    summary: 'Perform a version-checked budget lifecycle transition',
    body: {
      type: 'object',
      required: ['expectedVersion'],
      properties: { expectedVersion: { type: 'integer', minimum: 1 } },
      additionalProperties: false,
    },
    response: {
      200: success({ type: 'object', properties: { budget: budgetDto }, required: ['budget'] }),
      ...errors,
    },
  },
  summary: {
    ...base,
    summary: 'Get approved budget totals',
    response: {
      200: success({
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              currencyCode: { type: 'string' },
              original: { type: 'string' },
              approvedChanges: { type: 'string' },
              revised: { type: 'string' },
              approvedRevisionNumber: { type: ['integer', 'null'] },
            },
            required: ['currencyCode', 'original', 'approvedChanges', 'revised', 'approvedRevisionNumber'],
          },
        },
        required: ['summary'],
      }),
      401: errors[401],
      403: errors[403],
      404: errors[404],
      500: errors[500],
    },
  },
} as const;
