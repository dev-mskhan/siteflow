// apps/server/src/modules/project/docs/procurement.api.schemas.ts
// Fastify JSON Schema definitions for OpenAPI/Swagger documentation for Phase 3 Procurement & Partner modules.

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
  422: { description: 'Validation / invalid lifecycle transition', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

const orgProjectParams = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SUBCONTRACTORS
// ═══════════════════════════════════════════════════════════════════════════════

const projectSubcontractorDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    subcontractorId: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    scopeDescription: { type: ['string', 'null'] },
    contractValue: { type: ['string', 'null'] },
    currencyCode: { type: ['string', 'null'] },
    startDate: { type: ['string', 'null'] },
    endDate: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'projectId', 'subcontractorId', 'status', 'createdAt', 'updatedAt'],
} as const;

const subcontractorContactDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    subcontractorId: { type: 'string' },
    name: { type: 'string' },
    role: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    isPrimary: { type: 'boolean' },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'subcontractorId', 'name', 'isPrimary', 'isActive', 'createdAt', 'updatedAt'],
} as const;

const subcontractorSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { subcontractor: projectSubcontractorDTOSchema },
      required: ['subcontractor'],
    },
  },
  required: ['success', 'data'],
} as const;

const subcontractorListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: projectSubcontractorDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

const subcontractorContactSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { contact: subcontractorContactDTOSchema },
      required: ['contact'],
    },
  },
  required: ['success', 'data'],
} as const;

export const listSubcontractorsSchemaDoc = {
  tags: ['subcontractors'],
  summary: 'List subcontractors assigned to a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    },
  },
  response: {
    200: subcontractorListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const assignSubcontractorSchemaDoc = {
  tags: ['subcontractors'],
  summary: 'Assign a subcontractor to a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['subcontractorId'],
    properties: {
      subcontractorId: { type: 'string', minLength: 1 },
      scopeDescription: { type: 'string', maxLength: 2000 },
      contractValue: { type: 'string' },
      currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
    },
  },
  response: {
    201: subcontractorSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 409: responses[409], 422: responses[422], 500: responses[500],
  },
};

export const getSubcontractorSchemaDoc = {
  tags: ['subcontractors'],
  summary: 'Get a project subcontractor assignment',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'subcontractorId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      subcontractorId: { type: 'string' },
    },
  },
  response: {
    200: subcontractorSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateSubcontractorSchemaDoc = {
  tags: ['subcontractors'],
  summary: 'Update a project subcontractor assignment',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'subcontractorId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      subcontractorId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
      scopeDescription: { type: 'string', maxLength: 2000 },
      contractValue: { type: ['string', 'null'] },
      currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
      startDate: { type: ['string', 'null'], format: 'date' },
      endDate: { type: ['string', 'null'], format: 'date' },
    },
  },
  response: {
    200: subcontractorSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const createSubcontractorContactSchemaDoc = {
  tags: ['subcontractors'],
  summary: 'Add a contact to a project subcontractor',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'subcontractorId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      subcontractorId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 300 },
      role: { type: 'string', maxLength: 200 },
      email: { type: 'string', format: 'email', maxLength: 254 },
      phone: { type: 'string', maxLength: 50 },
      isPrimary: { type: 'boolean', default: false },
    },
  },
  response: {
    201: subcontractorContactSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const updateSubcontractorContactSchemaDoc = {
  tags: ['subcontractors'],
  summary: 'Update a project subcontractor contact',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'subcontractorId', 'contactId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      subcontractorId: { type: 'string' },
      contactId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 300 },
      role: { type: 'string', maxLength: 200 },
      email: { type: ['string', 'null'], format: 'email', maxLength: 254 },
      phone: { type: 'string', maxLength: 50 },
      isPrimary: { type: 'boolean' },
      isActive: { type: 'boolean' },
    },
  },
  response: {
    200: subcontractorContactSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const assignSubcontractorTaskSchemaDoc = {
  tags: ['subcontractors'],
  summary: 'Assign a task to a project subcontractor',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'subcontractorId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      subcontractorId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['taskId'],
    properties: {
      taskId: { type: 'string', minLength: 1 },
      assignmentRole: { type: 'string', maxLength: 200 },
    },
  },
  response: {
    201: { description: 'Task assigned successfully' },
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 409: responses[409], 422: responses[422], 500: responses[500],
  },
};

export const removeSubcontractorTaskSchemaDoc = {
  tags: ['subcontractors'],
  summary: 'Remove a task assignment from a project subcontractor',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'subcontractorId', 'taskId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      subcontractorId: { type: 'string' },
      taskId: { type: 'string' },
    },
  },
  response: {
    204: { description: 'Task assignment removed' },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

const materialRequestItemDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    materialId: { type: 'string' },
    description: { type: ['string', 'null'] },
    quantity: { type: 'string' },
    unitCode: { type: 'string' },
    requiredByDate: { type: ['string', 'null'] },
    taskId: { type: ['string', 'null'] },
    phaseId: { type: ['string', 'null'] },
    costCodeId: { type: ['string', 'null'] },
    boqLineId: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
  required: ['id', 'materialId', 'quantity', 'unitCode'],
} as const;

const materialRequestDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    requestNumber: { type: 'string' },
    requestedByMemberId: { type: 'string' },
    status: {
      type: 'string',
      enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_ORDERED', 'ORDERED', 'FULFILLED', 'CANCELLED', 'REJECTED'],
    },
    requiredByDate: { type: ['string', 'null'] },
    deliveryLocation: { type: ['string', 'null'] },
    priority: { type: ['string', 'null'], enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT', null] },
    notes: { type: ['string', 'null'] },
    submittedAt: { type: ['string', 'null'], format: 'date-time' },
    approvedAt: { type: ['string', 'null'], format: 'date-time' },
    cancelledAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    items: { type: 'array', items: materialRequestItemDTOSchema },
  },
  required: ['id', 'organizationId', 'projectId', 'requestNumber', 'requestedByMemberId', 'status', 'createdAt', 'updatedAt', 'items'],
} as const;

const materialRequestSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { materialRequest: materialRequestDTOSchema },
      required: ['materialRequest'],
    },
  },
  required: ['success', 'data'],
} as const;

const materialRequestListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: materialRequestDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

export const listMaterialRequestsSchemaDoc = {
  tags: ['material-requests'],
  summary: 'List material requests in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: {
        type: 'string',
        enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_ORDERED', 'ORDERED', 'FULFILLED', 'CANCELLED', 'REJECTED'],
      },
    },
  },
  response: {
    200: materialRequestListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const createMaterialRequestSchemaDoc = {
  tags: ['material-requests'],
  summary: 'Create a material request in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['items'],
    properties: {
      requiredByDate: { type: 'string', format: 'date' },
      deliveryLocation: { type: 'string', maxLength: 500 },
      priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
      notes: { type: 'string', maxLength: 4000 },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['materialId', 'quantity', 'unitCode'],
          properties: {
            materialId: { type: 'string', minLength: 1 },
            description: { type: 'string', maxLength: 500 },
            quantity: { type: 'string' },
            unitCode: { type: 'string', maxLength: 20 },
            requiredByDate: { type: 'string', format: 'date' },
            taskId: { type: 'string' },
            phaseId: { type: 'string' },
            costCodeId: { type: 'string' },
            boqLineId: { type: 'string' },
            notes: { type: 'string', maxLength: 1000 },
          },
        },
      },
    },
  },
  response: {
    201: materialRequestSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    422: responses[422], 500: responses[500],
  },
};

export const getMaterialRequestSchemaDoc = {
  tags: ['material-requests'],
  summary: 'Get a material request by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'requestId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      requestId: { type: 'string' },
    },
  },
  response: {
    200: materialRequestSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateMaterialRequestSchemaDoc = {
  tags: ['material-requests'],
  summary: 'Update material request header fields',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'requestId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      requestId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      requiredByDate: { type: 'string', format: 'date' },
      deliveryLocation: { type: 'string', maxLength: 500 },
      priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
      notes: { type: 'string', maxLength: 4000 },
    },
  },
  response: {
    200: materialRequestSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const submitMaterialRequestSchemaDoc = {
  tags: ['material-requests'],
  summary: 'Submit a material request for review (DRAFT→SUBMITTED)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'requestId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      requestId: { type: 'string' },
    },
  },
  response: {
    200: materialRequestSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

export const cancelMaterialRequestSchemaDoc = {
  tags: ['material-requests'],
  summary: 'Cancel a material request',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'requestId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      requestId: { type: 'string' },
    },
  },
  response: {
    200: materialRequestSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTES
// ═══════════════════════════════════════════════════════════════════════════════

const quoteItemDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    materialRequestItemId: { type: ['string', 'null'] },
    materialId: { type: 'string' },
    description: { type: ['string', 'null'] },
    quantity: { type: 'string' },
    unitCode: { type: 'string' },
    unitPrice: { type: 'string' },
    discountAmount: { type: ['string', 'null'] },
    taxAmount: { type: ['string', 'null'] },
    lineTotal: { type: 'string' },
    expectedDeliveryDate: { type: ['string', 'null'] },
  },
  required: ['id', 'materialId', 'quantity', 'unitCode', 'unitPrice', 'lineTotal'],
} as const;

const quoteDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    quoteNumber: { type: 'string' },
    supplierId: { type: 'string' },
    materialRequestId: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] },
    quoteDate: { type: 'string' },
    validUntil: { type: ['string', 'null'] },
    currencyCode: { type: 'string' },
    subtotal: { type: 'string' },
    discountAmount: { type: 'string' },
    taxAmount: { type: 'string' },
    totalAmount: { type: 'string' },
    notes: { type: ['string', 'null'] },
    submittedAt: { type: ['string', 'null'], format: 'date-time' },
    acceptedAt: { type: ['string', 'null'], format: 'date-time' },
    rejectedAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    items: { type: 'array', items: quoteItemDTOSchema },
  },
  required: ['id', 'organizationId', 'projectId', 'quoteNumber', 'supplierId', 'status', 'quoteDate', 'currencyCode', 'subtotal', 'discountAmount', 'taxAmount', 'totalAmount', 'createdAt', 'updatedAt', 'items'],
} as const;

const quoteSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { quote: quoteDTOSchema },
      required: ['quote'],
    },
  },
  required: ['success', 'data'],
} as const;

const quoteListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: quoteDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

export const listQuotesSchemaDoc = {
  tags: ['quotes'],
  summary: 'List quotes in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] },
    },
  },
  response: {
    200: quoteListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const createQuoteSchemaDoc = {
  tags: ['quotes'],
  summary: 'Create a supplier quote for a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['supplierId', 'quoteDate', 'currencyCode', 'items'],
    properties: {
      supplierId: { type: 'string', minLength: 1 },
      materialRequestId: { type: 'string' },
      quoteDate: { type: 'string', format: 'date' },
      validUntil: { type: 'string', format: 'date' },
      currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
      notes: { type: 'string', maxLength: 4000 },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['materialId', 'quantity', 'unitCode', 'unitPrice'],
          properties: {
            materialRequestItemId: { type: 'string' },
            materialId: { type: 'string', minLength: 1 },
            description: { type: 'string', maxLength: 500 },
            quantity: { type: 'string' },
            unitCode: { type: 'string', maxLength: 20 },
            unitPrice: { type: 'string' },
            discountAmount: { type: 'string' },
            taxAmount: { type: 'string' },
            expectedDeliveryDate: { type: 'string', format: 'date' },
          },
        },
      },
    },
  },
  response: {
    201: quoteSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const getQuoteSchemaDoc = {
  tags: ['quotes'],
  summary: 'Get a quote by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'quoteId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      quoteId: { type: 'string' },
    },
  },
  response: {
    200: quoteSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateQuoteSchemaDoc = {
  tags: ['quotes'],
  summary: 'Update quote header fields',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'quoteId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      quoteId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      quoteDate: { type: 'string', format: 'date' },
      validUntil: { type: ['string', 'null'], format: 'date' },
      notes: { type: 'string', maxLength: 4000 },
    },
  },
  response: {
    200: quoteSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const submitQuoteSchemaDoc = {
  tags: ['quotes'],
  summary: 'Submit a quote (DRAFT→SUBMITTED)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'quoteId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      quoteId: { type: 'string' },
    },
  },
  response: {
    200: quoteSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

export const acceptQuoteSchemaDoc = {
  tags: ['quotes'],
  summary: 'Accept a quote (SUBMITTED→ACCEPTED)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'quoteId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      quoteId: { type: 'string' },
    },
  },
  response: {
    200: quoteSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

export const rejectQuoteSchemaDoc = {
  tags: ['quotes'],
  summary: 'Reject a quote (SUBMITTED→REJECTED)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'quoteId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      quoteId: { type: 'string' },
    },
  },
  response: {
    200: quoteSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROCUREMENT APPROVALS
// ═══════════════════════════════════════════════════════════════════════════════

const procurementApprovalDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    resourceType: { type: 'string', enum: ['MATERIAL_REQUEST', 'QUOTE', 'PURCHASE_ORDER'] },
    resourceId: { type: 'string' },
    status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] },
    requestedBy: { type: 'string' },
    requestedAt: { type: 'string', format: 'date-time' },
    reviewedBy: { type: ['string', 'null'] },
    reviewedAt: { type: ['string', 'null'], format: 'date-time' },
    decisionReason: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'projectId', 'resourceType', 'resourceId', 'status', 'requestedBy', 'requestedAt', 'createdAt', 'updatedAt'],
} as const;

const approvalSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { approval: procurementApprovalDTOSchema },
      required: ['approval'],
    },
  },
  required: ['success', 'data'],
} as const;

const approvalListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: procurementApprovalDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

export const listApprovalsSchemaDoc = {
  tags: ['procurement-approvals'],
  summary: 'List procurement approvals in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] },
    },
  },
  response: {
    200: approvalListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const createApprovalSchemaDoc = {
  tags: ['procurement-approvals'],
  summary: 'Create a procurement approval request',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['resourceType', 'resourceId'],
    properties: {
      resourceType: { type: 'string', enum: ['MATERIAL_REQUEST', 'QUOTE', 'PURCHASE_ORDER'] },
      resourceId: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: approvalSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 409: responses[409], 422: responses[422], 500: responses[500],
  },
};

export const getApprovalSchemaDoc = {
  tags: ['procurement-approvals'],
  summary: 'Get a procurement approval by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'approvalId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      approvalId: { type: 'string' },
    },
  },
  response: {
    200: approvalSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const approveApprovalSchemaDoc = {
  tags: ['procurement-approvals'],
  summary: 'Approve a procurement approval request (PENDING→APPROVED)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'approvalId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      approvalId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      decisionReason: { type: 'string', maxLength: 2000 },
    },
  },
  response: {
    200: approvalSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const rejectApprovalSchemaDoc = {
  tags: ['procurement-approvals'],
  summary: 'Reject a procurement approval request (PENDING→REJECTED)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'approvalId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      approvalId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      decisionReason: { type: 'string', maxLength: 2000 },
    },
  },
  response: {
    200: approvalSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const cancelApprovalSchemaDoc = {
  tags: ['procurement-approvals'],
  summary: 'Cancel a procurement approval request',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'approvalId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      approvalId: { type: 'string' },
    },
  },
  response: {
    200: approvalSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

const poItemDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    materialId: { type: 'string' },
    description: { type: ['string', 'null'] },
    quantity: { type: 'string' },
    unitCode: { type: 'string' },
    unitPrice: { type: 'string' },
    discountAmount: { type: ['string', 'null'] },
    taxAmount: { type: ['string', 'null'] },
    lineTotal: { type: 'string' },
    materialRequestItemId: { type: ['string', 'null'] },
    sourceQuoteItemId: { type: ['string', 'null'] },
    taskId: { type: ['string', 'null'] },
    phaseId: { type: ['string', 'null'] },
    costCodeId: { type: ['string', 'null'] },
    boqLineId: { type: ['string', 'null'] },
    expectedDeliveryDate: { type: ['string', 'null'] },
  },
  required: ['id', 'materialId', 'quantity', 'unitCode', 'unitPrice', 'lineTotal'],
} as const;

const purchaseOrderDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    poNumber: { type: 'string' },
    supplierId: { type: 'string' },
    materialRequestId: { type: ['string', 'null'] },
    sourceQuoteId: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED'],
    },
    orderDate: { type: 'string' },
    expectedDeliveryDate: { type: ['string', 'null'] },
    deliveryLocation: { type: ['string', 'null'] },
    currencyCode: { type: 'string' },
    subtotal: { type: 'string' },
    discountAmount: { type: 'string' },
    taxAmount: { type: 'string' },
    totalAmount: { type: 'string' },
    notes: { type: ['string', 'null'] },
    createdByMemberId: { type: 'string' },
    approvedAt: { type: ['string', 'null'], format: 'date-time' },
    approvedBy: { type: ['string', 'null'] },
    sentAt: { type: ['string', 'null'], format: 'date-time' },
    cancelledAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    items: { type: 'array', items: poItemDTOSchema },
  },
  required: ['id', 'organizationId', 'projectId', 'poNumber', 'supplierId', 'status', 'orderDate', 'currencyCode', 'subtotal', 'discountAmount', 'taxAmount', 'totalAmount', 'createdByMemberId', 'createdAt', 'updatedAt', 'items'],
} as const;

const purchaseOrderSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { purchaseOrder: purchaseOrderDTOSchema },
      required: ['purchaseOrder'],
    },
  },
  required: ['success', 'data'],
} as const;

const purchaseOrderListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: purchaseOrderDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

export const listPurchaseOrdersSchemaDoc = {
  tags: ['purchase-orders'],
  summary: 'List purchase orders in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: {
        type: 'string',
        enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED'],
      },
    },
  },
  response: {
    200: purchaseOrderListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const createPurchaseOrderSchemaDoc = {
  tags: ['purchase-orders'],
  summary: 'Create a purchase order in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['supplierId', 'orderDate', 'currencyCode', 'items'],
    properties: {
      supplierId: { type: 'string', minLength: 1 },
      materialRequestId: { type: 'string' },
      sourceQuoteId: { type: 'string' },
      orderDate: { type: 'string', format: 'date' },
      expectedDeliveryDate: { type: 'string', format: 'date' },
      deliveryLocation: { type: 'string', maxLength: 500 },
      currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
      notes: { type: 'string', maxLength: 4000 },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['materialId', 'quantity', 'unitCode', 'unitPrice'],
          properties: {
            materialId: { type: 'string', minLength: 1 },
            description: { type: 'string', maxLength: 500 },
            quantity: { type: 'string' },
            unitCode: { type: 'string', maxLength: 20 },
            unitPrice: { type: 'string' },
            discountAmount: { type: 'string' },
            taxAmount: { type: 'string' },
            materialRequestItemId: { type: 'string' },
            sourceQuoteItemId: { type: 'string' },
            taskId: { type: 'string' },
            phaseId: { type: 'string' },
            costCodeId: { type: 'string' },
            boqLineId: { type: 'string' },
            expectedDeliveryDate: { type: 'string', format: 'date' },
          },
        },
      },
    },
  },
  response: {
    201: purchaseOrderSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const getPurchaseOrderSchemaDoc = {
  tags: ['purchase-orders'],
  summary: 'Get a purchase order by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'poId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      poId: { type: 'string' },
    },
  },
  response: {
    200: purchaseOrderSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updatePurchaseOrderSchemaDoc = {
  tags: ['purchase-orders'],
  summary: 'Update mutable purchase order fields',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'poId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      poId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      expectedDeliveryDate: { type: ['string', 'null'], format: 'date' },
      deliveryLocation: { type: 'string', maxLength: 500 },
      notes: { type: 'string', maxLength: 4000 },
    },
  },
  response: {
    200: purchaseOrderSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const submitPurchaseOrderSchemaDoc = {
  tags: ['purchase-orders'],
  summary: 'Submit a purchase order for approval (DRAFT→PENDING_APPROVAL)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'poId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      poId: { type: 'string' },
    },
  },
  response: {
    200: purchaseOrderSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

export const approvePurchaseOrderSchemaDoc = {
  tags: ['purchase-orders'],
  summary: 'Approve a purchase order (PENDING_APPROVAL→APPROVED)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'poId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      poId: { type: 'string' },
    },
  },
  response: {
    200: purchaseOrderSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

export const sendPurchaseOrderSchemaDoc = {
  tags: ['purchase-orders'],
  summary: 'Send a purchase order to the supplier (APPROVED→SENT)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'poId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      poId: { type: 'string' },
    },
  },
  response: {
    200: purchaseOrderSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

export const cancelPurchaseOrderSchemaDoc = {
  tags: ['purchase-orders'],
  summary: 'Cancel a purchase order',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'poId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      poId: { type: 'string' },
    },
  },
  response: {
    200: purchaseOrderSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMMITTED COSTS
// ═══════════════════════════════════════════════════════════════════════════════

const committedCostDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    sourceType: { type: 'string', enum: ['PURCHASE_ORDER'] },
    sourceId: { type: 'string' },
    supplierId: { type: ['string', 'null'] },
    purchaseOrderId: { type: ['string', 'null'] },
    costCodeId: { type: ['string', 'null'] },
    taskId: { type: ['string', 'null'] },
    boqLineId: { type: ['string', 'null'] },
    currencyCode: { type: 'string' },
    committedAmount: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'RELEASED', 'CANCELLED'] },
    committedAt: { type: 'string', format: 'date-time' },
    releasedAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'projectId', 'sourceType', 'sourceId', 'currencyCode', 'committedAmount', 'status', 'committedAt', 'createdAt', 'updatedAt'],
} as const;

const committedCostSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { committedCost: committedCostDTOSchema },
      required: ['committedCost'],
    },
  },
  required: ['success', 'data'],
} as const;

const committedCostListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: committedCostDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

export const listCommittedCostsSchemaDoc = {
  tags: ['committed-costs'],
  summary: 'List committed costs in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: { type: 'string', enum: ['ACTIVE', 'RELEASED', 'CANCELLED'] },
    },
  },
  response: {
    200: committedCostListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const getCommittedCostSchemaDoc = {
  tags: ['committed-costs'],
  summary: 'Get a committed cost entry by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'committedCostId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      committedCostId: { type: 'string' },
    },
  },
  response: {
    200: committedCostSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERIES
// ═══════════════════════════════════════════════════════════════════════════════

const deliveryItemDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    purchaseOrderItemId: { type: 'string' },
    quantity: { type: 'string' },
    unitCode: { type: 'string' },
    notes: { type: ['string', 'null'] },
  },
  required: ['id', 'purchaseOrderItemId', 'quantity', 'unitCode'],
} as const;

const deliveryDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    purchaseOrderId: { type: 'string' },
    deliveryNumber: { type: 'string' },
    status: { type: 'string', enum: ['SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] },
    scheduledDate: { type: ['string', 'null'] },
    actualDeliveryDate: { type: ['string', 'null'] },
    supplierReference: { type: ['string', 'null'] },
    carrier: { type: ['string', 'null'] },
    trackingReference: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    items: { type: 'array', items: deliveryItemDTOSchema },
  },
  required: ['id', 'organizationId', 'projectId', 'purchaseOrderId', 'deliveryNumber', 'status', 'createdAt', 'updatedAt', 'items'],
} as const;

const deliverySuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { delivery: deliveryDTOSchema },
      required: ['delivery'],
    },
  },
  required: ['success', 'data'],
} as const;

const deliveryListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: deliveryDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

export const listDeliveriesSchemaDoc = {
  tags: ['deliveries'],
  summary: 'List deliveries in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    },
  },
  response: {
    200: deliveryListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const createDeliverySchemaDoc = {
  tags: ['deliveries'],
  summary: 'Create a delivery record for a purchase order',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['purchaseOrderId', 'items'],
    properties: {
      purchaseOrderId: { type: 'string', minLength: 1 },
      scheduledDate: { type: 'string', format: 'date' },
      supplierReference: { type: 'string', maxLength: 200 },
      carrier: { type: 'string', maxLength: 200 },
      trackingReference: { type: 'string', maxLength: 200 },
      notes: { type: 'string', maxLength: 4000 },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['purchaseOrderItemId', 'quantity', 'unitCode'],
          properties: {
            purchaseOrderItemId: { type: 'string', minLength: 1 },
            quantity: { type: 'string' },
            unitCode: { type: 'string', maxLength: 20 },
            notes: { type: 'string', maxLength: 1000 },
          },
        },
      },
    },
  },
  response: {
    201: deliverySuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const getDeliverySchemaDoc = {
  tags: ['deliveries'],
  summary: 'Get a delivery by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'deliveryId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      deliveryId: { type: 'string' },
    },
  },
  response: {
    200: deliverySuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateDeliverySchemaDoc = {
  tags: ['deliveries'],
  summary: 'Update delivery details',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'deliveryId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      deliveryId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] },
      scheduledDate: { type: 'string', format: 'date' },
      actualDeliveryDate: { type: 'string', format: 'date' },
      supplierReference: { type: 'string', maxLength: 200 },
      carrier: { type: 'string', maxLength: 200 },
      trackingReference: { type: 'string', maxLength: 200 },
      notes: { type: 'string', maxLength: 4000 },
    },
  },
  response: {
    200: deliverySuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIPTS
// ═══════════════════════════════════════════════════════════════════════════════

const receiptItemDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    purchaseOrderItemId: { type: 'string' },
    quantityDelivered: { type: 'string' },
    quantityAccepted: { type: 'string' },
    quantityRejected: { type: ['string', 'null'] },
    unitCode: { type: 'string' },
    rejectionReason: { type: ['string', 'null'] },
    condition: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
  required: ['id', 'purchaseOrderItemId', 'quantityDelivered', 'quantityAccepted', 'unitCode'],
} as const;

const receiptDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    purchaseOrderId: { type: 'string' },
    deliveryId: { type: ['string', 'null'] },
    receiptNumber: { type: 'string' },
    status: { type: 'string', enum: ['DRAFT', 'POSTED', 'VOIDED'] },
    receivedAt: { type: 'string', format: 'date-time' },
    receivedByMemberId: { type: 'string' },
    notes: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    items: { type: 'array', items: receiptItemDTOSchema },
  },
  required: ['id', 'organizationId', 'projectId', 'purchaseOrderId', 'receiptNumber', 'status', 'receivedAt', 'receivedByMemberId', 'createdAt', 'items'],
} as const;

const receiptSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { receipt: receiptDTOSchema },
      required: ['receipt'],
    },
  },
  required: ['success', 'data'],
} as const;

const receiptListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: receiptDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

export const listReceiptsSchemaDoc = {
  tags: ['receipts'],
  summary: 'List goods receipts in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    },
  },
  response: {
    200: receiptListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const createReceiptSchemaDoc = {
  tags: ['receipts'],
  summary: 'Create a goods receipt for a purchase order',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['purchaseOrderId', 'receivedAt', 'items'],
    properties: {
      purchaseOrderId: { type: 'string', minLength: 1 },
      deliveryId: { type: 'string' },
      receivedAt: { type: 'string', format: 'date-time' },
      notes: { type: 'string', maxLength: 4000 },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['purchaseOrderItemId', 'quantityDelivered', 'quantityAccepted', 'unitCode'],
          properties: {
            purchaseOrderItemId: { type: 'string', minLength: 1 },
            quantityDelivered: { type: 'string' },
            quantityAccepted: { type: 'string' },
            quantityRejected: { type: 'string' },
            unitCode: { type: 'string', maxLength: 20 },
            rejectionReason: { type: 'string', maxLength: 1000 },
            condition: { type: 'string', maxLength: 200 },
            notes: { type: 'string', maxLength: 1000 },
          },
        },
      },
    },
  },
  response: {
    201: receiptSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const getReceiptSchemaDoc = {
  tags: ['receipts'],
  summary: 'Get a goods receipt by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'receiptId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      receiptId: { type: 'string' },
    },
  },
  response: {
    200: receiptSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const postReceiptSchemaDoc = {
  tags: ['receipts'],
  summary: 'Post a goods receipt (DRAFT→POSTED), updating inventory',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'receiptId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      receiptId: { type: 'string' },
    },
  },
  response: {
    200: receiptSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

export const voidReceiptSchemaDoc = {
  tags: ['receipts'],
  summary: 'Void a posted goods receipt (POSTED→VOIDED), reversing inventory',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'receiptId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      receiptId: { type: 'string' },
    },
  },
  response: {
    200: receiptSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════

const inventoryBalanceDTOSchema = {
  type: 'object',
  properties: {
    materialId: { type: 'string' },
    materialCode: { type: 'string' },
    materialName: { type: 'string' },
    unitCode: { type: 'string' },
    quantityOnHand: { type: 'string' },
    quantityReserved: { type: 'string' },
    quantityAvailable: { type: 'string' },
    location: { type: ['string', 'null'] },
    lastUpdatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['materialId', 'unitCode', 'quantityOnHand', 'quantityReserved', 'quantityAvailable'],
} as const;

const inventoryTransactionDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    materialId: { type: 'string' },
    direction: { type: 'string', enum: ['IN', 'OUT'] },
    quantity: { type: 'string' },
    unitCode: { type: 'string' },
    sourceType: { type: ['string', 'null'] },
    sourceId: { type: ['string', 'null'] },
    location: { type: ['string', 'null'] },
    reason: { type: ['string', 'null'] },
    occurredAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'materialId', 'direction', 'quantity', 'unitCode', 'occurredAt', 'createdAt'],
} as const;

export const listInventorySchemaDoc = {
  tags: ['inventory'],
  summary: 'List all material balances in a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: inventoryBalanceDTOSchema },
          },
          required: ['items'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const getInventoryBalanceSchemaDoc = {
  tags: ['inventory'],
  summary: 'Get inventory balance for a specific material',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'materialId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      materialId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { balance: inventoryBalanceDTOSchema },
          required: ['balance'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const listInventoryTransactionsSchemaDoc = {
  tags: ['inventory'],
  summary: 'List inventory transactions for a material in a project',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'materialId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      materialId: { type: 'string' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: inventoryTransactionDTOSchema },
            nextCursor: { type: ['string', 'null'] },
          },
          required: ['items', 'nextCursor'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const adjustInventorySchemaDoc = {
  tags: ['inventory'],
  summary: 'Create a manual inventory adjustment',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['materialId', 'quantity', 'unitCode', 'direction', 'reason'],
    properties: {
      materialId: { type: 'string', minLength: 1 },
      location: { type: 'string' },
      quantity: { type: 'string' },
      unitCode: { type: 'string', maxLength: 20 },
      direction: { type: 'string', enum: ['IN', 'OUT'] },
      reason: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { transaction: inventoryTransactionDTOSchema },
          required: ['transaction'],
        },
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const transferInventorySchemaDoc = {
  tags: ['inventory'],
  summary: 'Transfer inventory between locations within a project',
  security: [{ bearerAuth: [] }],
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['materialId', 'quantity', 'unitCode', 'fromLocation', 'toLocation'],
    properties: {
      materialId: { type: 'string', minLength: 1 },
      quantity: { type: 'string' },
      unitCode: { type: 'string', maxLength: 20 },
      fromLocation: { type: 'string', minLength: 1 },
      toLocation: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            transactions: { type: 'array', items: inventoryTransactionDTOSchema },
          },
          required: ['transactions'],
        },
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

const performanceEventDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    partnerType: { type: 'string', enum: ['SUPPLIER', 'SUBCONTRACTOR'] },
    supplierId: { type: ['string', 'null'] },
    subcontractorId: { type: ['string', 'null'] },
    sourceType: { type: ['string', 'null'] },
    sourceId: { type: ['string', 'null'] },
    eventType: {
      type: 'string',
      enum: [
        'DELIVERY_ON_TIME', 'DELIVERY_LATE', 'DELIVERY_PARTIAL', 'DELIVERY_CANCELLED',
        'RECEIPT_REJECTION', 'RECEIPT_DISCREPANCY', 'PO_CANCELLED',
        'WORK_COMPLETED', 'WORK_COMPLETED_LATE', 'WORK_DELAYED',
        'SCOPE_CHANGE', 'QUALITY_ISSUE',
      ],
    },
    occurredAt: { type: 'string', format: 'date-time' },
    metricValue: { type: ['number', 'null'] },
    unit: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'projectId', 'partnerType', 'eventType', 'occurredAt', 'createdAt'],
} as const;

const performanceListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: performanceEventDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    },
  },
  required: ['success', 'data'],
} as const;

export const getSupplierPerformanceSchemaDoc = {
  tags: ['performance'],
  summary: 'Get performance events for a supplier in a project',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'supplierId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      supplierId: { type: 'string' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    },
  },
  response: {
    200: performanceListSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const getSubcontractorPerformanceSchemaDoc = {
  tags: ['performance'],
  summary: 'Get performance events for a subcontractor in a project',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'subcontractorId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      subcontractorId: { type: 'string' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    },
  },
  response: {
    200: performanceListSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};
