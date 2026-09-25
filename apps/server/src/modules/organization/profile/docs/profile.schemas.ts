// apps/server/src/modules/organization/profile/docs/profile.schemas.ts

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

const profileSchema = {
  type: 'object',
  properties: {
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    legalName: { type: 'string', nullable: true, example: 'Acme Construction LLC' },
    businessName: { type: 'string', nullable: true, example: 'Acme Construction' },
    businessType: {
      type: 'string',
      nullable: true,
      enum: [
        'GENERAL_CONTRACTOR',
        'SUBCONTRACTOR',
        'SPECIALTY_CONTRACTOR',
        'DESIGN_BUILD',
        'DEVELOPER',
        'CONSULTANT',
        'OTHER',
      ],
    },
    registrationNumber: { type: 'string', nullable: true },
    taxIdentificationNumber: { type: 'string', nullable: true },
    primaryEmail: { type: 'string', nullable: true, format: 'email', example: 'info@acme.com' },
    primaryPhone: { type: 'string', nullable: true, example: '+1-555-0100' },
    secondaryPhone: { type: 'string', nullable: true },
    website: { type: 'string', nullable: true, format: 'uri', example: 'https://acme.com' },
    addressLine1: { type: 'string', nullable: true },
    addressLine2: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    stateProvince: { type: 'string', nullable: true },
    postalCode: { type: 'string', nullable: true },
    country: { type: 'string', nullable: true, minLength: 2, maxLength: 2, example: 'US' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const paramsSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
  },
} as const;

export const getProfileSchemaDoc = {
  tags: ['profiles'],
  summary: 'Get organization profile',
  description: 'Returns the organization profile. Requires organization:read permission.',
  params: paramsSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { profile: profileSchema },
          required: ['profile'],
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

export const updateProfileSchemaDoc = {
  tags: ['profiles'],
  summary: 'Update organization profile',
  description: 'Partially updates the organization profile. All fields are optional. Requires organization:update permission.',
  params: paramsSchema,
  body: {
    type: 'object',
    properties: {
      legalName: { type: 'string', nullable: true },
      businessName: { type: 'string', nullable: true },
      businessType: {
        type: 'string',
        nullable: true,
        enum: [
          'GENERAL_CONTRACTOR',
          'SUBCONTRACTOR',
          'SPECIALTY_CONTRACTOR',
          'DESIGN_BUILD',
          'DEVELOPER',
          'CONSULTANT',
          'OTHER',
        ],
      },
      registrationNumber: { type: 'string', nullable: true },
      taxIdentificationNumber: { type: 'string', nullable: true },
      primaryEmail: { type: 'string', nullable: true, format: 'email' },
      primaryPhone: { type: 'string', nullable: true },
      secondaryPhone: { type: 'string', nullable: true },
      website: { type: 'string', nullable: true, format: 'uri' },
      addressLine1: { type: 'string', nullable: true },
      addressLine2: { type: 'string', nullable: true },
      city: { type: 'string', nullable: true },
      stateProvince: { type: 'string', nullable: true },
      postalCode: { type: 'string', nullable: true },
      country: { type: 'string', nullable: true, minLength: 2, maxLength: 2 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: { profile: profileSchema },
          required: ['profile'],
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
