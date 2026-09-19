// apps/server/src/modules/audit/docs/audit.schemas.ts
// OpenAPI / Swagger JSON-Schema definitions for the audit module.

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

const auditLogSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'aud_01J9Z0F8QPXKMPQ1VRFP1D5K3F' },
    organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    actorUserId: { type: 'string', nullable: true, example: 'usr_01J9Z0F8QPXKMPQ1VRFP1D5K3B' },
    action: { type: 'string', example: 'organization.created' },
    resourceType: { type: 'string', nullable: true, example: 'Organization' },
    resourceId: { type: 'string', nullable: true, example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    metadata: { type: 'object', example: { name: 'Acme Construction' } },
    ipAddress: { type: 'string', nullable: true, example: '192.168.1.1' },
    userAgent: { type: 'string', nullable: true, example: 'Mozilla/5.0 ...' },
    createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
  },
  required: ['id', 'organizationId', 'action', 'createdAt'],
} as const;

const responses = {
  401: { description: 'Unauthorized', ...apiErrorSchema },
  403: { description: 'Forbidden', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

export const listAuditLogsSchemaDoc = {
  tags: ['audit'],
  summary: 'List organization audit logs',
  description: 'Returns paginated security audit log trail for the specified organization. Requires audit:read permission.',
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: {
      organizationId: { type: 'string', example: '01J9Z0F8QPXKMPQ1VRFP1D5K3A' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50, example: 50 },
      offset: { type: 'integer', minimum: 0, default: 0, example: 0 },
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
            logs: {
              type: 'array',
              items: auditLogSchema,
            },
          },
          required: ['logs'],
        },
        meta: {
          type: 'object',
          properties: {
            limit: { type: 'integer', example: 50 },
            offset: { type: 'integer', example: 0 },
            total: { type: 'integer', example: 10 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
      required: ['success', 'data'],
    },
    401: responses[401],
    403: responses[403],
    500: responses[500],
  },
};
