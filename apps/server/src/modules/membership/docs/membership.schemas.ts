// apps/server/src/modules/membership/docs/membership.schemas.ts
// OpenAPI / Swagger JSON-Schema definitions for the membership module.

const errorDetailSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', example: 'FORBIDDEN' },
    message: { type: 'string', example: 'Access denied' },
    requestId: { type: 'string', example: 'uuid-request-id' },
  },
  required: ['code', 'message'],
} as const;

const apiErrorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false], example: false },
    error: errorDetailSchema,
  },
  required: ['success', 'error'],
} as const;

const memberSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'mem_01J9Z0F8QPXKMPQ1VRFP1D5K3C' },
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    userId: { type: 'string', example: 'usr_01J9Z0F8QPXKMPQ1VRFP1D5K3B' },
    roleId: { type: 'string', example: 'rol_01J9Z0F8QPXKMPQ1VRFP1D5K3D' },
    roleName: { type: 'string', example: 'Organization Admin' },
    userEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
    userFirstName: { type: 'string', example: 'Jane' },
    userLastName: { type: 'string', nullable: true, example: 'Doe' },
    status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'REMOVED'], example: 'ACTIVE' },
    joinedAt: { type: 'string', format: 'date-time', nullable: true, example: '2024-01-01T00:00:00.000Z' },
    createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
    updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
  },
  required: ['id', 'organizationId', 'userId', 'roleId', 'status', 'createdAt', 'updatedAt'],
} as const;

const responses = {
  401: { description: 'Unauthorized', ...apiErrorSchema },
  403: { description: 'Forbidden', ...apiErrorSchema },
  404: { description: 'Not found', ...apiErrorSchema },
  422: { description: 'Validation error', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

export const listMembersSchemaDoc = {
  tags: ['members'],
  summary: 'List organization members',
  description: 'Returns list of active and suspended members for the given organization. Requires member:read permission.',
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: {
            members: {
              type: 'array',
              items: memberSchema,
            },
          },
          required: ['members'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    500: responses[500],
  },
};

export const getMemberSchemaDoc = {
  tags: ['members'],
  summary: 'Get member details by ID',
  description: 'Returns member details for the specified member ID within the organization. Requires member:read permission.',
  params: {
    type: 'object',
    required: ['organizationId', 'memberId'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
      memberId: { type: 'string', example: 'mem_01J9Z0F8QPXKMPQ1VRFP1D5K3C' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { member: memberSchema },
          required: ['member'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    404: responses[404],
    500: responses[500],
  },
};

export const updateMemberSchemaDoc = {
  tags: ['members'],
  summary: 'Update organization member role or status',
  description: 'Updates member roleId or status (ACTIVE/SUSPENDED) and invalidates Redis permission cache synchronously. Requires member:update permission.',
  params: {
    type: 'object',
    required: ['organizationId', 'memberId'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
      memberId: { type: 'string', example: 'mem_01J9Z0F8QPXKMPQ1VRFP1D5K3C' },
    },
  },
  body: {
    type: 'object',
    properties: {
      roleId: { type: 'string', format: 'uuid', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3D' },
      status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'], example: 'ACTIVE' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { member: memberSchema },
          required: ['member'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    404: responses[404],
    422: responses[422],
    500: responses[500],
  },
};

export const removeMemberSchemaDoc = {
  tags: ['members'],
  summary: 'Remove organization member',
  description: 'Soft removes member (sets status = REMOVED) and invalidates permission cache. Cannot remove last Organization Admin. Requires member:remove permission.',
  params: {
    type: 'object',
    required: ['organizationId', 'memberId'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
      memberId: { type: 'string', example: 'mem_01J9Z0F8QPXKMPQ1VRFP1D5K3C' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { message: { type: 'string', example: 'Member removed successfully' } },
          required: ['message'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    404: responses[404],
    422: responses[422],
    500: responses[500],
  },
};
