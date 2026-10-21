const pathParams = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    projectId: { type: 'string', minLength: 1, maxLength: 128 },
    sheetId: { type: 'string', minLength: 1, maxLength: 128 },
    measurementId: { type: 'string', minLength: 1, maxLength: 128 },
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

const sheetDto = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] },
    version: { type: 'integer' },
    currentRevisionNumber: { type: 'integer' },
    createdBy: { type: 'string' },
    submittedBy: { type: ['string', 'null'] },
    submittedAt: { type: ['string', 'null'] },
    approvedBy: { type: ['string', 'null'] },
    approvedAt: { type: ['string', 'null'] },
    rejectedBy: { type: ['string', 'null'] },
    rejectedAt: { type: ['string', 'null'] },
    rejectionReason: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'organizationId', 'projectId', 'title', 'status', 'version', 'currentRevisionNumber'],
} as const;

const revisionDto = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sheetId: { type: 'string' },
    revisionNumber: { type: 'integer' },
    status: { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] },
    createdBy: { type: 'string' },
    createdAt: { type: 'string' },
    submittedAt: { type: ['string', 'null'] },
    approvedAt: { type: ['string', 'null'] },
    rejectedAt: { type: ['string', 'null'] },
  },
  required: ['id', 'sheetId', 'revisionNumber', 'status'],
} as const;

const formulaInputDto = {
  type: 'object',
  properties: {
    variableName: { type: 'string' },
    value: { type: 'string' },
    unit: { type: 'string' },
    dimension: { type: 'string', enum: ['LENGTH', 'AREA', 'VOLUME', 'COUNT'] },
  },
  required: ['variableName', 'value', 'unit', 'dimension'],
} as const;

const measurementDto = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    revisionId: { type: 'string' },
    sourceId: { type: ['string', 'null'] },
    description: { type: 'string' },
    dimension: { type: 'string', enum: ['LENGTH', 'AREA', 'VOLUME', 'COUNT'] },
    unit: { type: 'string' },
    measurementMode: { type: 'string', enum: ['MANUAL', 'FORMULA'] },
    manualQuantity: { type: ['string', 'null'] },
    formulaText: { type: ['string', 'null'] },
    deductionQuantity: { type: 'string' },
    wastePercent: { type: 'string' },
    grossQuantity: { type: 'string' },
    resultQuantity: { type: 'string' },
    boqItemId: { type: ['string', 'null'] },
    costCodeId: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    inputs: { type: 'array', items: formulaInputDto },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'revisionId', 'description', 'dimension', 'unit', 'measurementMode', 'resultQuantity'],
} as const;

const sourceDto = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sheetId: { type: 'string' },
    documentId: { type: 'string' },
    documentVersionId: { type: 'string' },
    pageReference: { type: 'string' },
    regionLabel: { type: ['string', 'null'] },
    createdBy: { type: 'string' },
    createdAt: { type: 'string' },
  },
  required: ['id', 'sheetId', 'documentId', 'documentVersionId', 'pageReference'],
} as const;

const successEnvelope = (data: Record<string, unknown>) => ({
  type: 'object',
  properties: { success: { type: 'boolean', enum: [true] }, data: { type: 'object', properties: data } },
  required: ['success', 'data'],
});

const paginationDto = {
  type: 'object',
  properties: {
    items: { type: 'array', items: sheetDto },
    nextCursor: { type: ['string', 'null'] },
  },
} as const;

const versionBody = {
  type: 'object',
  required: ['expectedVersion'],
  properties: { expectedVersion: { type: 'integer', minimum: 1 } },
  additionalProperties: false,
} as const;

const sheetIdParam = pathParams;

export const takeoffRouteDocs = {
  create: {
    tags: ['takeoff'],
    summary: 'Create a quantity takeoff sheet',
    params: pathParams,
    body: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 160 },
        description: { type: ['string', 'null'], maxLength: 2000 },
      },
      additionalProperties: false,
    },
    response: {
      201: successEnvelope({ sheet: sheetDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
    },
  },
  list: {
    tags: ['takeoff'],
    summary: 'List takeoff sheets for a project',
    params: pathParams,
    querystring: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        cursor: { type: 'string', maxLength: 256 },
        status: { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] },
      },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope(paginationDto.properties),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
    },
  },
  get: {
    tags: ['takeoff'],
    summary: 'Get a takeoff sheet',
    params: sheetIdParam,
    response: {
      200: successEnvelope({ sheet: sheetDto }),
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
    },
  },
  update: {
    tags: ['takeoff'],
    summary: 'Update takeoff sheet metadata (DRAFT only)',
    params: sheetIdParam,
    body: {
      type: 'object',
      required: ['expectedVersion'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 160 },
        description: { type: ['string', 'null'], maxLength: 2000 },
        expectedVersion: { type: 'integer', minimum: 1 },
      },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({ sheet: sheetDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
      409: errorSchema,
    },
  },
  transition: {
    tags: ['takeoff'],
    summary: 'Submit or approve a takeoff sheet revision',
    params: sheetIdParam,
    body: versionBody,
    response: {
      200: successEnvelope({ sheet: sheetDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
      409: errorSchema,
    },
  },
  reject: {
    tags: ['takeoff'],
    summary: 'Reject a pending takeoff sheet revision with a reason',
    params: sheetIdParam,
    body: {
      type: 'object',
      required: ['expectedVersion', 'reason'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1 },
        reason: { type: 'string', minLength: 10, maxLength: 500 },
      },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({ sheet: sheetDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
      409: errorSchema,
    },
  },
  createRevision: {
    tags: ['takeoff'],
    summary: 'Create a new revision from the current approved or rejected revision',
    params: sheetIdParam,
    body: versionBody,
    response: {
      201: successEnvelope({ revision: revisionDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
      409: errorSchema,
    },
  },
  listRevisions: {
    tags: ['takeoff'],
    summary: 'List revisions for a takeoff sheet',
    params: sheetIdParam,
    response: {
      200: successEnvelope({ revisions: { type: 'array', items: revisionDto } }),
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
    },
  },
  compareRevisions: {
    tags: ['takeoff'],
    summary: 'Compare two revisions of a takeoff sheet by stable measurement key',
    params: sheetIdParam,
    querystring: {
      type: 'object',
      required: ['fromRevision', 'toRevision'],
      properties: {
        fromRevision: { type: 'integer', minimum: 1 },
        toRevision: { type: 'integer', minimum: 1 },
      },
      additionalProperties: false,
    },
    response: {
      200: { type: 'object' },
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
    },
  },
  listMeasurements: {
    tags: ['takeoff'],
    summary: 'List measurements for a revision (defaults to the current revision)',
    params: sheetIdParam,
    querystring: {
      type: 'object',
      properties: { revisionNumber: { type: 'integer', minimum: 1 } },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({ measurements: { type: 'array', items: measurementDto } }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
    },
  },
  createMeasurement: {
    tags: ['takeoff'],
    summary: 'Create a manual or formula measurement on the current DRAFT revision',
    params: sheetIdParam,
    body: {
      type: 'object',
      required: ['description', 'dimension', 'unit', 'measurementMode'],
      properties: {
        description: { type: 'string', minLength: 1, maxLength: 500 },
        dimension: { type: 'string', enum: ['LENGTH', 'AREA', 'VOLUME', 'COUNT'] },
        unit: { type: 'string', minLength: 1, maxLength: 32 },
        measurementMode: { type: 'string', enum: ['MANUAL', 'FORMULA'] },
        sourceId: { type: ['string', 'null'] },
        manualQuantity: { type: ['string', 'null'] },
        formulaText: { type: ['string', 'null'], maxLength: 500 },
        inputs: { type: 'array', maxItems: 20, items: formulaInputDto },
        deductionQuantity: { type: 'string' },
        wastePercent: { type: 'string' },
        boqItemId: { type: ['string', 'null'] },
        costCodeId: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'], maxLength: 2000 },
      },
      additionalProperties: false,
    },
    response: {
      201: successEnvelope({ measurement: measurementDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
      409: errorSchema,
      422: errorSchema,
    },
  },
  updateMeasurement: {
    tags: ['takeoff'],
    summary: 'Update a measurement on the current DRAFT revision',
    params: pathParams,
    body: {
      type: 'object',
      required: ['expectedVersion'],
      properties: {
        description: { type: 'string', minLength: 1, maxLength: 500 },
        dimension: { type: 'string', enum: ['LENGTH', 'AREA', 'VOLUME', 'COUNT'] },
        unit: { type: 'string', minLength: 1, maxLength: 32 },
        measurementMode: { type: 'string', enum: ['MANUAL', 'FORMULA'] },
        sourceId: { type: ['string', 'null'] },
        manualQuantity: { type: ['string', 'null'] },
        formulaText: { type: ['string', 'null'], maxLength: 500 },
        inputs: { type: 'array', maxItems: 20, items: formulaInputDto },
        deductionQuantity: { type: 'string' },
        wastePercent: { type: 'string' },
        boqItemId: { type: ['string', 'null'] },
        costCodeId: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'], maxLength: 2000 },
        expectedVersion: { type: 'integer', minimum: 1 },
      },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({ measurement: measurementDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
      409: errorSchema,
      422: errorSchema,
    },
  },
  listSources: {
    tags: ['takeoff'],
    summary: 'List document sources linked to a takeoff sheet',
    params: sheetIdParam,
    querystring: {
      type: 'object',
      properties: { revisionNumber: { type: 'integer', minimum: 1 } },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({ sources: { type: 'array', items: sourceDto } }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
    },
  },
  createSource: {
    tags: ['takeoff'],
    summary: 'Link an active project document version as a source on the current DRAFT revision',
    params: sheetIdParam,
    body: {
      type: 'object',
      required: ['documentId', 'documentVersionId', 'pageReference'],
      properties: {
        documentId: { type: 'string', minLength: 1, maxLength: 128 },
        documentVersionId: { type: 'string', minLength: 1, maxLength: 128 },
        pageReference: { type: 'string', minLength: 1, maxLength: 64 },
        regionLabel: { type: ['string', 'null'], maxLength: 160 },
      },
      additionalProperties: false,
    },
    response: {
      201: successEnvelope({ source: sourceDto }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
      409: errorSchema,
    },
  },
  previewFormula: {
    tags: ['takeoff'],
    summary: 'Evaluate a takeoff formula against sample inputs without saving',
    params: pathParams,
    body: {
      type: 'object',
      required: ['formulaText', 'dimension', 'unit'],
      properties: {
        formulaText: { type: 'string', minLength: 1, maxLength: 500 },
        inputs: { type: 'array', maxItems: 20, items: formulaInputDto },
        dimension: { type: 'string', enum: ['LENGTH', 'AREA', 'VOLUME', 'COUNT'] },
        unit: { type: 'string', minLength: 1, maxLength: 32 },
      },
      additionalProperties: false,
    },
    response: {
      200: successEnvelope({
        result: { type: 'string' },
        unit: { type: 'string' },
        dimension: { type: 'string' },
      }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      422: errorSchema,
    },
  },
  summary: {
    tags: ['takeoff'],
    summary: 'Summarise quantities across approved takeoff sheets',
    params: pathParams,
    querystring: {
      type: 'object',
      properties: {
        groupBy: { type: 'string', enum: ['BOQ_ITEM', 'COST_CODE', 'SHEET'], default: 'SHEET' },
      },
      additionalProperties: false,
    },
    response: {
      200: { type: 'object' },
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
    },
  },
} as const;
