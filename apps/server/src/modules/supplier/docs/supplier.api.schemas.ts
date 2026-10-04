// apps/server/src/modules/supplier/docs/supplier.api.schemas.ts
// Fastify JSON Schema definitions for OpenAPI/Swagger documentation for the Supplier module.

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

const orgSupplierParams = {
  type: 'object',
  required: ['organizationId', 'supplierId'],
  properties: {
    organizationId: { type: 'string' },
    supplierId: { type: 'string' },
  },
} as const;

const orgSupplierContactParams = {
  type: 'object',
  required: ['organizationId', 'supplierId', 'contactId'],
  properties: {
    organizationId: { type: 'string' },
    supplierId: { type: 'string' },
    contactId: { type: 'string' },
  },
} as const;

// ── DTO Schemas ───────────────────────────────────────────────────────────────

const supplierDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    supplierCode: { type: 'string' },
    legalName: { type: 'string' },
    displayName: { type: 'string' },
    supplierType: {
      type: ['string', 'null'],
      enum: ['MATERIAL_SUPPLIER', 'SERVICE_PROVIDER', 'EQUIPMENT_SUPPLIER', 'GENERAL_SUPPLIER', null],
    },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
    taxReference: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    website: { type: ['string', 'null'] },
    paymentTerms: { type: ['string', 'null'] },
    currencyCode: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'supplierCode', 'legalName', 'displayName', 'status', 'createdAt', 'updatedAt'],
} as const;

const supplierContactDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    supplierId: { type: 'string' },
    name: { type: 'string' },
    role: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    isPrimary: { type: 'boolean' },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'organizationId', 'supplierId', 'name', 'isPrimary', 'isActive', 'createdAt', 'updatedAt'],
} as const;

const supplierSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: supplierDTOSchema,
    meta: {
      type: 'object',
      properties: { timestamp: { type: 'string' } },
    },
  },
  required: ['success', 'data'],
} as const;

const supplierListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: { type: 'array', items: supplierDTOSchema },
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

const supplierContactSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: supplierContactDTOSchema,
    meta: {
      type: 'object',
      properties: { timestamp: { type: 'string' } },
    },
  },
  required: ['success', 'data'],
} as const;

// ── Route schemas ─────────────────────────────────────────────────────────────

export const listSuppliersSchemaDoc = {
  tags: ['suppliers'],
  summary: 'List suppliers in an organization',
  security: [{ bearerAuth: [] }],
  params: orgParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
    },
  },
  response: {
    200: supplierListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const createSupplierSchemaDoc = {
  tags: ['suppliers'],
  summary: 'Create a new supplier',
  security: [{ bearerAuth: [] }],
  params: orgParams,
  body: {
    type: 'object',
    required: ['supplierCode', 'legalName', 'displayName'],
    properties: {
      supplierCode: { type: 'string', minLength: 1, maxLength: 50 },
      legalName: { type: 'string', minLength: 1, maxLength: 500 },
      displayName: { type: 'string', minLength: 1, maxLength: 500 },
      supplierType: { type: 'string', enum: ['MATERIAL_SUPPLIER', 'SERVICE_PROVIDER', 'EQUIPMENT_SUPPLIER', 'GENERAL_SUPPLIER'] },
      taxReference: { type: 'string', maxLength: 200 },
      email: { type: 'string', format: 'email', maxLength: 254 },
      phone: { type: 'string', maxLength: 50 },
      address: { type: 'string', maxLength: 1000 },
      website: { type: 'string', format: 'uri', maxLength: 500 },
      paymentTerms: { type: 'string', maxLength: 500 },
      currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
      notes: { type: 'string', maxLength: 4000 },
    },
  },
  response: {
    201: supplierSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    409: responses[409], 422: responses[422], 500: responses[500],
  },
};

export const getSupplierSchemaDoc = {
  tags: ['suppliers'],
  summary: 'Get a supplier by ID',
  security: [{ bearerAuth: [] }],
  params: orgSupplierParams,
  response: {
    200: supplierSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateSupplierSchemaDoc = {
  tags: ['suppliers'],
  summary: 'Update supplier details',
  security: [{ bearerAuth: [] }],
  params: orgSupplierParams,
  body: {
    type: 'object',
    properties: {
      legalName: { type: 'string', minLength: 1, maxLength: 500 },
      displayName: { type: 'string', minLength: 1, maxLength: 500 },
      supplierType: { type: 'string', enum: ['MATERIAL_SUPPLIER', 'SERVICE_PROVIDER', 'EQUIPMENT_SUPPLIER', 'GENERAL_SUPPLIER'] },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
      taxReference: { type: 'string', maxLength: 200 },
      email: { type: ['string', 'null'], format: 'email', maxLength: 254 },
      phone: { type: 'string', maxLength: 50 },
      address: { type: 'string', maxLength: 1000 },
      website: { type: ['string', 'null'], maxLength: 500 },
      paymentTerms: { type: 'string', maxLength: 500 },
      currencyCode: { type: 'string', minLength: 3, maxLength: 3 },
      notes: { type: 'string', maxLength: 4000 },
    },
  },
  response: {
    200: supplierSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const createSupplierContactSchemaDoc = {
  tags: ['suppliers'],
  summary: 'Add a contact to a supplier',
  security: [{ bearerAuth: [] }],
  params: orgSupplierParams,
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
    201: supplierContactSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const updateSupplierContactSchemaDoc = {
  tags: ['suppliers'],
  summary: 'Update a supplier contact',
  security: [{ bearerAuth: [] }],
  params: orgSupplierContactParams,
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
    200: supplierContactSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 422: responses[422], 500: responses[500],
  },
};
