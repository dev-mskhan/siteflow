// apps/server/src/modules/project/docs/project.api.schemas.ts
// Fastify JSON Schema definitions for OpenAPI/serialization.

const metaSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'string', format: 'date-time' },
    requestId: { type: 'string' },
  },
  additionalProperties: true,
} as const;

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
  409: { description: 'Conflict / optimistic lock failure', ...apiErrorSchema },
  422: { description: 'Validation / invalid transition error', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

export const projectDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectNumber: { type: 'string', example: 'PRJ-0001' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
    },
    projectType: {
      type: ['string', 'null'],
      enum: ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER', null],
    },
    contractValue: { type: ['string', 'null'] },
    currency: { type: 'string', example: 'USD' },
    plannedStartDate: { type: ['string', 'null'] },
    plannedEndDate: { type: ['string', 'null'] },
    actualStartDate: { type: ['string', 'null'] },
    actualEndDate: { type: ['string', 'null'] },
    createdBy: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id', 'organizationId', 'projectNumber', 'name', 'status',
    'currency', 'createdAt', 'updatedAt',
  ],
} as const;

const projectSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: { project: projectDTOSchema },
      required: ['project'],
    },
    meta: metaSchema,
  },
  required: ['success', 'data'],
} as const;

const projectListSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      properties: {
        projects: { type: 'array', items: projectDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['projects', 'nextCursor'],
    },
    meta: metaSchema,
  },
  required: ['success', 'data'],
} as const;

// ── Route schemas ─────────────────────────────────────────────────────────────

export const createProjectSchemaDoc = {
  tags: ['projects'],
  summary: 'Create a new project',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: { organizationId: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
      projectType: { type: 'string', enum: ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER'] },
      contractValue: { type: 'string' },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      plannedStartDate: { type: 'string', format: 'date' },
      plannedEndDate: { type: 'string', format: 'date' },
    },
  },
  response: {
    201: projectSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    422: responses[422], 500: responses[500],
  },
};

export const listProjectsSchemaDoc = {
  tags: ['projects'],
  summary: 'List projects in an organization',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: { organizationId: { type: 'string' } },
  },
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'] },
      search: { type: 'string' },
    },
  },
  response: {
    200: projectListSuccessResponse,
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const getProjectSchemaDoc = {
  tags: ['projects'],
  summary: 'Get a project by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  response: {
    200: projectSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateProjectSchemaDoc = {
  tags: ['projects'],
  summary: 'Update project metadata',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['expectedVersion'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: ['string', 'null'] },
      projectType: { type: ['string', 'null'], enum: ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER', null] },
      contractValue: { type: ['string', 'null'] },
      plannedStartDate: { type: ['string', 'null'], format: 'date' },
      plannedEndDate: { type: ['string', 'null'], format: 'date' },
      expectedVersion: { type: 'integer', minimum: 1 },
    },
  },
  response: {
    200: projectSuccessResponse,
    400: responses[400], 401: responses[401], 403: responses[403],
    404: responses[404], 409: responses[409], 422: responses[422], 500: responses[500],
  },
};

export const lifecycleSchemaDoc = {
  tags: ['projects'],
  summary: 'Transition project lifecycle status',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  response: {
    200: projectSuccessResponse,
    401: responses[401], 403: responses[403], 404: responses[404],
    422: responses[422], 500: responses[500],
  },
};

const projectParams = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
  },
} as const;

const userProjectParams = {
  type: 'object',
  required: ['organizationId', 'projectId', 'userId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    userId: { type: 'string' },
  },
} as const;

const phaseParams = {
  type: 'object',
  required: ['organizationId', 'projectId', 'phaseId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    phaseId: { type: 'string' },
  },
} as const;

const costCodeParams = {
  type: 'object',
  required: ['organizationId', 'projectId', 'codeId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    codeId: { type: 'string' },
  },
} as const;

// ── Members ─────────────────────────────────────────────────────────────────

export const listMembersSchemaDoc = {
  tags: ['projects'],
  summary: 'List project members',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { members: { type: 'array' } },
          required: ['members'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const addMemberSchemaDoc = {
  tags: ['projects'],
  summary: 'Add member to project',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  body: {
    type: 'object',
    required: ['userId', 'role'],
    properties: {
      userId: { type: 'string' },
      role: {
        type: 'string',
        enum: ['PROJECT_MANAGER', 'SITE_SUPERVISOR', 'PROJECT_MEMBER', 'FINANCE', 'PROCUREMENT', 'SUBCONTRACTOR', 'CLIENT'],
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { member: { type: 'object' } },
          required: ['member'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const updateMemberRoleSchemaDoc = {
  tags: ['projects'],
  summary: 'Update project member role',
  security: [{ bearerAuth: [] }],
  params: userProjectParams,
  body: {
    type: 'object',
    required: ['role'],
    properties: {
      role: {
        type: 'string',
        enum: ['PROJECT_MANAGER', 'SITE_SUPERVISOR', 'PROJECT_MEMBER', 'FINANCE', 'PROCUREMENT', 'SUBCONTRACTOR', 'CLIENT'],
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { member: { type: 'object' } },
          required: ['member'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const removeMemberSchemaDoc = {
  tags: ['projects'],
  summary: 'Remove member from project',
  security: [{ bearerAuth: [] }],
  params: userProjectParams,
  response: {
    204: { type: 'null', description: 'Member removed' },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

// ── Settings ────────────────────────────────────────────────────────────────

export const getSettingsSchemaDoc = {
  tags: ['projects'],
  summary: 'Get effective project settings',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { settings: { type: 'object' } },
          required: ['settings'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateSettingsSchemaDoc = {
  tags: ['projects'],
  summary: 'Update project settings',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  body: {
    type: 'object',
    properties: {
      timezone: { type: 'string', minLength: 1, maxLength: 100 },
      locale: { type: 'string', minLength: 2, maxLength: 20 },
      dateFormat: { type: 'string', enum: ['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD'] },
      timeFormat: { type: 'string', enum: ['H12', 'H24'] },
      unitSystem: { type: 'string', enum: ['METRIC', 'IMPERIAL'] },
      weekStartsOn: { type: 'integer', minimum: 0, maximum: 6 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { settings: { type: 'object' } },
          required: ['settings'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

// ── Phases ──────────────────────────────────────────────────────────────────

export const listPhasesSchemaDoc = {
  tags: ['projects'],
  summary: 'List project phases',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  querystring: {
    type: 'object',
    properties: {
      includeArchived: { type: ['boolean', 'string'] },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { phases: { type: 'array' } },
          required: ['phases'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const createPhaseSchemaDoc = {
  tags: ['projects'],
  summary: 'Create a project phase',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
      startsAt: { type: 'string', format: 'date' },
      endsAt: { type: 'string', format: 'date' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { phase: { type: 'object' } },
          required: ['phase'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const updatePhaseSchemaDoc = {
  tags: ['projects'],
  summary: 'Update a project phase',
  security: [{ bearerAuth: [] }],
  params: phaseParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: ['string', 'null'], maxLength: 2000 },
      startsAt: { type: ['string', 'null'], format: 'date' },
      endsAt: { type: ['string', 'null'], format: 'date' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { phase: { type: 'object' } },
          required: ['phase'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const archivePhaseSchemaDoc = {
  tags: ['projects'],
  summary: 'Archive a project phase',
  security: [{ bearerAuth: [] }],
  params: phaseParams,
  response: {
    204: { type: 'null', description: 'Phase archived' },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const reorderPhasesSchemaDoc = {
  tags: ['projects'],
  summary: 'Reorder project phases',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  body: {
    type: 'object',
    required: ['orderedIds'],
    properties: {
      orderedIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { phases: { type: 'array' } },
          required: ['phases'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

// ── Cost Codes ──────────────────────────────────────────────────────────────

export const listCostCodesSchemaDoc = {
  tags: ['projects'],
  summary: 'List project cost codes',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  querystring: {
    type: 'object',
    properties: {
      includeInactive: { type: ['boolean', 'string'] },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { costCodes: { type: 'array' } },
          required: ['costCodes'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const createCostCodeSchemaDoc = {
  tags: ['projects'],
  summary: 'Create a project cost code',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  body: {
    type: 'object',
    required: ['code'],
    properties: {
      code: { type: 'string', minLength: 1, maxLength: 50 },
      description: { type: 'string', maxLength: 2000 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { costCode: { type: 'object' } },
          required: ['costCode'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 409: responses[409], 422: responses[422], 500: responses[500],
  },
};

export const updateCostCodeSchemaDoc = {
  tags: ['projects'],
  summary: 'Update a project cost code',
  security: [{ bearerAuth: [] }],
  params: costCodeParams,
  body: {
    type: 'object',
    properties: {
      code: { type: 'string', minLength: 1, maxLength: 50 },
      description: { type: ['string', 'null'], maxLength: 2000 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { costCode: { type: 'object' } },
          required: ['costCode'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

export const deactivateCostCodeSchemaDoc = {
  tags: ['projects'],
  summary: 'Deactivate a project cost code',
  security: [{ bearerAuth: [] }],
  params: costCodeParams,
  response: {
    204: { type: 'null', description: 'Cost code deactivated' },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

// ── Project Audit ───────────────────────────────────────────────────────────

export const listProjectAuditSchemaDoc = {
  tags: ['projects'],
  summary: 'List project audit logs',
  security: [{ bearerAuth: [] }],
  params: projectParams,
  querystring: {
    type: 'object',
    properties: {
      resourceType: { type: 'string' },
      actorUserId: { type: 'string' },
      dateFrom: { type: 'string', format: 'date' },
      dateTo: { type: 'string', format: 'date' },
      action: { type: 'string' },
      cursor: { type: 'string' },
      limit: { type: ['integer', 'string'], minimum: 1, maximum: 100 },
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
            auditLogs: { type: 'array' },
            nextCursor: { type: ['string', 'null'] },
          },
          required: ['auditLogs', 'nextCursor'],
        },
        meta: metaSchema,
      },
      required: ['success', 'data'],
    },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};
