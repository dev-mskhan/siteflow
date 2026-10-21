// apps/server/src/modules/ai/docs/ai.api.schemas.ts
// OpenAPI / Swagger JSON-Schema definitions for the AI module.

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

const stdResponses = {
  401: { description: 'Unauthorized', ...apiErrorSchema },
  403: { description: 'Forbidden', ...apiErrorSchema },
  404: { description: 'Not found', ...apiErrorSchema },
  422: { description: 'Validation error', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

const sec = [{ bearerAuth: [] }] as const;

const orgParams = {
  type: 'object',
  required: ['organizationId'],
  properties: { organizationId: { type: 'string' } },
} as const;

const runParams = {
  type: 'object',
  required: ['organizationId', 'runId'],
  properties: { organizationId: { type: 'string' }, runId: { type: 'string' } },
} as const;

const approvalParams = {
  type: 'object',
  required: ['organizationId', 'approvalId'],
  properties: { organizationId: { type: 'string' }, approvalId: { type: 'string' } },
} as const;

const conversationParams = {
  type: 'object',
  required: ['organizationId', 'conversationId'],
  properties: { organizationId: { type: 'string' }, conversationId: { type: 'string' } },
} as const;

// ── Agent Run Schemas ────────────────────────────────────────────────────────

export const startRunSchemaDoc = {
  tags: ['ai-runs'],
  summary: 'Start an asynchronous agent run',
  description: 'Validates input, checks tier limits & tenant scope, creates an agent run, and enqueues a background job.',
  security: sec,
  params: orgParams,
  headers: {
    type: 'object',
    properties: {
      'x-correlation-id': { type: 'string', description: 'Correlation ID for distributed tracing' },
    },
  },
  body: {
    type: 'object',
    required: ['agent'],
    properties: {
      agent: { type: 'string', description: 'Registered agent name (e.g. cost-financial, echo)' },
      projectId: { type: 'string', nullable: true },
      channel: { type: 'string', enum: ['api', 'chat', 'voice'], default: 'api' },
      conversationId: { type: 'string', nullable: true },
      parentRunId: { type: 'string', nullable: true },
      input: { type: 'object', additionalProperties: true },
    },
  },
  response: {
    202: {
      description: 'Run successfully queued',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            runId: { type: 'string' },
            status: { type: 'string', example: 'QUEUED' },
          },
          required: ['runId', 'status'],
        },
      },
    },
    ...stdResponses,
  },
} as const;

export const listRunsSchemaDoc = {
  tags: ['ai-runs'],
  summary: 'List agent runs for organization',
  security: sec,
  params: orgParams,
  querystring: {
    type: 'object',
    properties: {
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      agent: { type: 'string' },
      status: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  response: {
    200: {
      description: 'Paginated list of runs',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const getRunSchemaDoc = {
  tags: ['ai-runs'],
  summary: 'Get details and output of an agent run',
  security: sec,
  params: runParams,
  response: {
    200: {
      description: 'Agent run details',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const cancelRunSchemaDoc = {
  tags: ['ai-runs'],
  summary: 'Cancel an active or queued agent run',
  security: sec,
  params: runParams,
  response: {
    200: {
      description: 'Run cancelled',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    ...stdResponses,
  },
} as const;

// ── Approval Schemas ────────────────────────────────────────────────────────

export const getApprovalSchemaDoc = {
  tags: ['ai-approvals'],
  summary: 'Get approval gate request details',
  security: sec,
  params: approvalParams,
  response: {
    200: {
      description: 'Approval details',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const approveApprovalSchemaDoc = {
  tags: ['ai-approvals'],
  summary: 'Approve a pending agent tool execution',
  security: sec,
  params: approvalParams,
  body: {
    type: 'object',
    properties: {
      note: { type: 'string', maxLength: 1000 },
    },
  },
  response: {
    200: {
      description: 'Approved and resumed',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const rejectApprovalSchemaDoc = {
  tags: ['ai-approvals'],
  summary: 'Reject a pending agent tool execution',
  security: sec,
  params: approvalParams,
  body: {
    type: 'object',
    required: ['reason'],
    properties: {
      reason: { type: 'string', minLength: 1, maxLength: 1000 },
    },
  },
  response: {
    200: {
      description: 'Rejected',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

// ── Conversation Schemas ───────────────────────────────────────────────────

export const createConversationSchemaDoc = {
  tags: ['ai-conversations'],
  summary: 'Create a new AI multi-turn conversation thread',
  security: sec,
  params: orgParams,
  body: {
    type: 'object',
    required: ['agent'],
    properties: {
      agent: { type: 'string' },
      projectId: { type: 'string', nullable: true },
      title: { type: 'string', maxLength: 255 },
    },
  },
  response: {
    201: {
      description: 'Conversation created',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const listConversationsSchemaDoc = {
  tags: ['ai-conversations'],
  summary: 'List AI conversations for organization',
  security: sec,
  params: orgParams,
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      cursor: { type: 'string' },
      projectId: { type: 'string' },
      agent: { type: 'string' },
    },
  },
  response: {
    200: {
      description: 'Conversation list',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const getConversationSchemaDoc = {
  tags: ['ai-conversations'],
  summary: 'Get conversation metadata and status',
  security: sec,
  params: conversationParams,
  response: {
    200: {
      description: 'Conversation record',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const archiveConversationSchemaDoc = {
  tags: ['ai-conversations'],
  summary: 'Archive an AI conversation',
  security: sec,
  params: conversationParams,
  response: {
    200: {
      description: 'Archived',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', properties: { archived: { type: 'boolean' } } },
      },
    },
    ...stdResponses,
  },
} as const;

export const sendMessageSchemaDoc = {
  tags: ['ai-conversations'],
  summary: 'Send a message and trigger agent reply',
  security: sec,
  params: conversationParams,
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 50000 },
    },
  },
  response: {
    201: {
      description: 'Message sent and run queued',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const listMessagesSchemaDoc = {
  tags: ['ai-conversations'],
  summary: 'List message history in an AI conversation',
  security: sec,
  params: conversationParams,
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      beforeId: { type: 'string' },
    },
  },
  response: {
    200: {
      description: 'List of messages',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ...stdResponses,
  },
} as const;

export const voiceMessageSchemaDoc = {
  tags: ['ai-conversations'],
  summary: 'Upload voice audio for transcription and AI reply',
  description: 'Accepts multipart/form-data audio, transcribes via STT (Whisper), guards transcript, and posts to conversation.',
  security: sec,
  params: conversationParams,
  response: {
    201: {
      description: 'Audio transcribed and run initiated',
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            transcript: { type: 'string' },
            runId: { type: 'string' },
          },
        },
      },
    },
    ...stdResponses,
  },
} as const;
