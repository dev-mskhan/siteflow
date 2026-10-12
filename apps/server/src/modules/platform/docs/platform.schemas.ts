// apps/server/src/modules/platform/docs/platform.schemas.ts
// OpenAPI / Swagger definitions for the platform read APIs (11-02).

const errorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false], example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'FORBIDDEN' },
        message: { type: 'string', example: 'Access denied' },
        requestId: { type: 'string', example: 'uuid-request-id' },
      },
      required: ['code', 'message'],
    },
  },
  required: ['success', 'error'],
} as const;

const pageMetaSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'string', format: 'date-time' },
    limit: { type: 'integer', example: 25 },
    nextCursor: { type: 'string', nullable: true, example: 'eyJ0IjoiMjAyNC0wMS0wMVQwMDowMDowMC4wMDBaIiwiaSI6IjAxSiJ9' },
  },
} as const;

const paginationQuery = {
  limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  cursor: { type: 'string', maxLength: 256, description: 'Opaque cursor from nextCursor' },
} as const;

const organizationSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    name: { type: 'string', example: 'Acme Construction' },
    slug: { type: 'string', example: 'acme-construction' },
    status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] },
    createdAt: { type: 'string', format: 'date-time' },
    owner: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string' },
        email: { type: 'string', example: 'a***@acme.com', description: 'Masked' },
      },
    },
    memberCount: { type: 'integer', example: 3 },
  },
} as const;

const accountSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'usr_01J9Z0F8QPXKMPQ1VRFP1D5K3B' },
    email: { type: 'string', example: 'a***@acme.com', description: 'Masked' },
    status: { type: 'string', example: 'ACTIVE' },
    emailVerifiedAt: { type: 'string', format: 'date-time', nullable: true },
    membershipCount: { type: 'integer', example: 2 },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

export const listPlatformOrganizationsSchemaDoc = {
  tags: ['Platform'],
  summary: 'List organizations (platform operators only)',
  description:
    'Requires a platform role with read:organizations. Organization members do not receive platform access. Keyset-paginated, newest first.',
  querystring: {
    type: 'object',
    properties: {
      ...paginationQuery,
      search: { type: 'string', minLength: 1, maxLength: 64, description: 'Slug prefix' },
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
            organizations: { type: 'array', items: organizationSummarySchema },
          },
        },
        meta: pageMetaSchema,
      },
    },
    401: errorSchema,
    403: errorSchema,
  },
} as const;

const lifecycleBodyDoc = {
  type: 'object',
  required: ['password', 'reasonCode', 'reasonNote'],
  properties: {
    password: { type: 'string', minLength: 1, maxLength: 256, description: 'Re-authentication' },
    reasonCode: { type: 'string', description: 'Reason enum (see LIFECYCLE_REASON_CODES)' },
    reasonNote: { type: 'string', minLength: 10, maxLength: 500 },
  },
} as const;

const lifecycleResultDoc = {
  200: {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  409: errorSchema,
} as const;

export const accountLifecycleSchemaDoc = (action: 'suspend' | 'reactivate') => ({
  tags: ['Platform'],
  summary: `${action === 'suspend' ? 'Suspend' : 'Reactivate'} a user account`,
  description:
    'Requires write:organization_lifecycle and password re-entry. Conditional transition; repeated requests return 409. Sessions are revoked on suspend.',
  body: lifecycleBodyDoc,
  response: lifecycleResultDoc,
});

export const requestOrgSuspensionSchemaDoc = {
  tags: ['Platform'],
  summary: 'Request organization suspension (second operator approval required)',
  body: lifecycleBodyDoc,
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', properties: { approvalId: { type: 'string' } } },
      },
    },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    409: errorSchema,
  },
} as const;

export const approveOrgSuspensionSchemaDoc = {
  tags: ['Platform'],
  summary: 'Approve a pending organization suspension (different operator)',
  body: lifecycleBodyDoc,
  response: lifecycleResultDoc,
} as const;

export const reactivateOrgSchemaDoc = {
  tags: ['Platform'],
  summary: 'Reactivate an organization (status only; billing and entitlements enforced separately)',
  body: lifecycleBodyDoc,
  response: lifecycleResultDoc,
} as const;

export const organizationBillingSchemaDoc = {
  tags: ['Platform'],
  summary: 'Organization billing view (subscription, recent invoices; no Stripe secrets or payment data)',
  description: 'Requires a platform role with read:billing. Does not grant access to tenant project or financial records.',
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    404: errorSchema,
  },
} as const;

export const webhookInboxSchemaDoc = {
  tags: ['Platform'],
  summary: 'Stripe webhook inbox status counts (platform-wide, not tenant-scoped)',
  description: 'Requires a platform role with read:billing.',
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            counts: { type: 'object', additionalProperties: { type: 'integer' } },
          },
        },
      },
    },
  },
} as const;

export const webhookRecoverySchemaDoc = {
  tags: ['Platform'],
  summary: 'Re-run bounded, idempotent Stripe webhook inbox recovery (password re-entry required)',
  description: 'Requires write:billing_sync. Safe to retry: recovery re-fetches Stripe state under a lease.',
  body: lifecycleBodyDoc,
  response: {
    202: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { processedCount: { type: 'integer' } },
        },
      },
    },
  },
} as const;

export const listPlatformAccountsSchemaDoc = {
  tags: ['Platform'],
  summary: 'List user accounts (platform operators only)',
  description:
    'Requires a platform role with read:organizations. Returns minimal identity fields only; email is masked and credentials are never returned.',
  querystring: {
    type: 'object',
    properties: {
      ...paginationQuery,
      emailPrefix: { type: 'string', minLength: 1, maxLength: 64 },
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
            accounts: { type: 'array', items: accountSummarySchema },
          },
        },
        meta: pageMetaSchema,
      },
    },
    401: errorSchema,
    403: errorSchema,
  },
} as const;
