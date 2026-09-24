// apps/server/src/modules/invitation/docs/invitation.schemas.ts
// OpenAPI / Swagger JSON-Schema definitions for the invitation module.

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

const invitationSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'inv_01J9Z0F8QPXKMPQ1VRFP1D5K3E' },
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    email: { type: 'string', format: 'email', example: 'invitee@example.com' },
    roleId: { type: 'string', example: 'rol_01J9Z0F8QPXKMPQ1VRFP1D5K3D' },
    roleName: { type: 'string', example: 'Project Manager' },
    status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'], example: 'PENDING' },
    expiresAt: { type: 'string', format: 'date-time', example: '2024-01-22T10:30:00.000Z' },
    acceptedAt: { type: 'string', format: 'date-time', nullable: true, example: null },
    invitedBy: { type: 'string', example: 'usr_01J9Z0F8QPXKMPQ1VRFP1D5K3B' },
    createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
  },
  required: ['id', 'organizationId', 'email', 'roleId', 'status', 'expiresAt', 'invitedBy', 'createdAt'],
} as const;

const responses = {
  401: { description: 'Unauthorized', ...apiErrorSchema },
  403: { description: 'Forbidden', ...apiErrorSchema },
  404: { description: 'Not found', ...apiErrorSchema },
  409: { description: 'Conflict (e.g. pending invitation already exists)', ...apiErrorSchema },
  422: { description: 'Validation error', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

export const createInvitationSchemaDoc = {
  tags: ['invitations'],
  summary: 'Create an organization invitation',
  description: 'Creates a pending invitation, writes outbox event for sending email via pg-boss queue, and logs audit event. Requires member:invite permission.',
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    },
  },
  body: {
    type: 'object',
    required: ['email', 'roleId'],
    properties: {
      email: { type: 'string', format: 'email', example: 'invitee@example.com' },
      roleId: { type: 'string', format: 'uuid', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3D' },
      orgName: { type: 'string', example: 'Acme Construction' },
      inviterName: { type: 'string', example: 'Jane Doe' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { invitation: invitationSchema },
          required: ['invitation'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    409: responses[409],
    422: responses[422],
    500: responses[500],
  },
};

export const listInvitationsSchemaDoc = {
  tags: ['invitations'],
  summary: 'List organization invitations',
  description: 'Returns list of invitations for the specified organization. Requires member:read permission.',
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
            invitations: {
              type: 'array',
              items: invitationSchema,
            },
          },
          required: ['invitations'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    500: responses[500],
  },
};

export const cancelInvitationSchemaDoc = {
  tags: ['invitations'],
  summary: 'Cancel pending invitation',
  description: 'Cancels a pending invitation and logs audit event. Requires invitation:cancel permission.',
  params: {
    type: 'object',
    required: ['organizationId', 'id'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
      id: { type: 'string', example: 'inv_01J9Z0F8QPXKMPQ1VRFP1D5K3E' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { message: { type: 'string', example: 'Invitation cancelled successfully' } },
          required: ['message'],
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

export const acceptInvitationSchemaDoc = {
  tags: ['invitations'],
  summary: 'Accept organization invitation',
  description: 'Accepts an invitation token from the request body, creating active membership in target organization. Token is passed in the body to avoid URL logging.',
  body: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string', minLength: 1, example: 'raw-one-time-token-hex' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { message: { type: 'string', example: 'Invitation accepted successfully' } },
          required: ['message'],
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    404: responses[404],
    422: responses[422],
    500: responses[500],
  },
};
