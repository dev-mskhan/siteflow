const params = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
    transactionId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  additionalProperties: false,
} as const;

const error = {
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

const transaction = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    costCodeId: { type: 'string' },
    phaseId: { type: ['string', 'null'] },
    taskId: { type: ['string', 'null'] },
    documentId: { type: ['string', 'null'] },
    sourceType: { type: 'string' },
    sourceId: { type: ['string', 'null'] },
    transactionDate: { type: 'string' },
    postingDate: { type: ['string', 'null'] },
    description: { type: 'string' },
    quantity: { type: ['string', 'null'] },
    unit: { type: ['string', 'null'] },
    unitCost: { type: ['string', 'null'] },
    subtotal: { type: 'string' },
    taxAmount: { type: 'string' },
    totalAmount: { type: 'string' },
    currencyCode: { type: 'string' },
    status: { type: 'string', enum: ['DRAFT', 'POSTED', 'VOIDED'] },
    createdBy: { type: 'string' },
    postedBy: { type: ['string', 'null'] },
    postedAt: { type: ['string', 'null'] },
    voidedBy: { type: ['string', 'null'] },
    voidedAt: { type: ['string', 'null'] },
    version: { type: 'integer' },
    reversalId: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
  },
  required: [
    'id', 'organizationId', 'projectId', 'costCodeId', 'phaseId', 'taskId', 'documentId',
    'sourceType', 'sourceId', 'transactionDate', 'postingDate', 'description', 'quantity',
    'unit', 'unitCost', 'subtotal', 'taxAmount', 'totalAmount', 'currencyCode', 'status',
    'createdBy', 'postedBy', 'postedAt', 'voidedBy', 'voidedAt', 'version', 'reversalId',
    'createdAt',
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
  400: error,
  401: error,
  403: error,
  404: error,
  409: error,
  422: error,
  500: error,
} as const;

const base = {
  tags: ['commercial cost transactions'],
  security: [{ bearerAuth: [] }],
  params,
} as const;

const idempotencyHeaders = {
  type: 'object',
  required: ['idempotency-key'],
  properties: { 'idempotency-key': { type: 'string', minLength: 1, maxLength: 255 } },
  additionalProperties: true,
} as const;

const transitionBody = {
  type: 'object',
  required: ['expectedVersion'],
  properties: { expectedVersion: { type: 'integer', minimum: 1 } },
  additionalProperties: false,
} as const;

export const costTransactionRouteDocs = {
  create: {
    ...base,
    summary: 'Create a draft project cost transaction',
    headers: idempotencyHeaders,
    body: {
      type: 'object',
      required: ['costCodeId', 'transactionDate', 'description', 'currencyCode'],
      properties: {
        costCodeId: { type: 'string', minLength: 1, maxLength: 128 },
        phaseId: { type: 'string', minLength: 1, maxLength: 128 },
        taskId: { type: 'string', minLength: 1, maxLength: 128 },
        documentId: { type: 'string', minLength: 1, maxLength: 128 },
        sourceType: { type: 'string', enum: ['MANUAL', 'DOCUMENT', 'TASK', 'PHASE'] },
        sourceId: { type: 'string', minLength: 1, maxLength: 128 },
        transactionDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        description: { type: 'string', minLength: 1, maxLength: 1000 },
        quantity: { type: 'string', pattern: '^\\d{1,12}(?:\\.\\d{1,3})?$' },
        unit: { type: 'string', minLength: 1, maxLength: 64 },
        unitCost: { type: 'string', pattern: '^\\d{1,13}(?:\\.\\d{1,2})?$' },
        subtotal: { type: 'string', pattern: '^\\d{1,13}(?:\\.\\d{1,2})?$' },
        taxAmount: { type: 'string', pattern: '^\\d{1,13}(?:\\.\\d{1,2})?$' },
        currencyCode: { type: 'string', pattern: '^[A-Za-z]{3}$' },
      },
      additionalProperties: false,
    },
    response: {
      201: success({ type: 'object', properties: { transaction }, required: ['transaction'] }),
      ...errors,
    },
  },
  list: {
    ...base,
    summary: 'List project cost transactions',
    querystring: {
      type: 'object',
      properties: {
        cursor: { type: 'string', maxLength: 512 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        status: { type: 'string', enum: ['DRAFT', 'POSTED', 'VOIDED'] },
        costCodeId: { type: 'string', minLength: 1, maxLength: 128 },
      },
      additionalProperties: false,
    },
    response: {
      200: success({
        type: 'object',
        properties: {
          transactions: { type: 'array', items: transaction },
          nextCursor: { type: ['string', 'null'] },
        },
        required: ['transactions', 'nextCursor'],
      }),
      ...errors,
    },
  },
  get: {
    ...base,
    summary: 'Get a project cost transaction',
    response: {
      200: success({ type: 'object', properties: { transaction }, required: ['transaction'] }),
      ...errors,
    },
  },
  post: {
    ...base,
    summary: 'Post a draft project cost transaction',
    headers: idempotencyHeaders,
    body: transitionBody,
    response: {
      200: success({ type: 'object', properties: { transaction }, required: ['transaction'] }),
      ...errors,
    },
  },
  void: {
    ...base,
    summary: 'Void a posted cost transaction with a linked reversal',
    headers: idempotencyHeaders,
    body: {
      type: 'object',
      required: ['expectedVersion', 'reason'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1 },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
      },
      additionalProperties: false,
    },
    response: {
      200: success({ type: 'object', properties: { transaction }, required: ['transaction'] }),
      ...errors,
    },
  },
} as const;
