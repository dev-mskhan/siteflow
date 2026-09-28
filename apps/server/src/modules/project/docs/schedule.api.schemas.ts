// apps/server/src/modules/project/docs/schedule.api.schemas.ts
// Fastify JSON Schema definitions for OpenAPI/Swagger documentation for Phase 3 Schedule Execution module.

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
  409: { description: 'Conflict / concurrency lock failure', ...apiErrorSchema },
  422: { description: 'Validation / invalid lifecycle state', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

// ── Tasks Swagger Schemas ───────────────────────────────────────────────────

export const createTaskSchemaDoc = {
  tags: ['tasks'],
  summary: 'Create a task in project schedule',
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
    required: ['name'],
    properties: {
      code: { type: 'string' },
      taskCode: { type: 'string' },
      name: { type: 'string', minLength: 1, maxLength: 255 },
      type: { type: 'string', enum: ['TASK', 'MILESTONE', 'SUMMARY'] },
      taskType: { type: 'string', enum: ['TASK', 'MILESTONE', 'SUMMARY'] },
      description: { type: 'string' },
      phaseId: { type: 'string' },
      parentTaskId: { type: 'string' },
      priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] },
      constraintType: { type: 'string', enum: ['ASAP', 'START_NO_EARLIER_THAN', 'FINISH_NO_LATER_THAN'] },
      constraintDate: { type: 'string', format: 'date' },
      currentStartDate: { type: 'string', format: 'date' },
      currentFinishDate: { type: 'string', format: 'date' },
      durationDays: { type: 'integer', minimum: 0 },
      currentDurationDays: { type: 'integer', minimum: 0 },
    },
  },
  response: {
    201: { description: 'Task created successfully' },
    400: responses[400], 401: responses[401], 403: responses[403], 409: responses[409], 500: responses[500],
  },
};

export const listTasksSchemaDoc = {
  tags: ['tasks'],
  summary: 'List project schedule tasks',
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
    200: { description: 'List of project tasks' },
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

export const getTaskSchemaDoc = {
  tags: ['tasks'],
  summary: 'Get task by ID',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'taskId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      taskId: { type: 'string' },
    },
  },
  response: {
    200: { description: 'Task details' },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateTaskSchemaDoc = {
  tags: ['tasks'],
  summary: 'Update task schedule properties',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'taskId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      taskId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['expectedVersion'],
    properties: {
      expectedVersion: { type: 'integer', minimum: 1 },
      name: { type: 'string' },
      description: { type: 'string' },
      currentStartDate: { type: 'string', format: 'date' },
      currentFinishDate: { type: 'string', format: 'date' },
      durationDays: { type: 'integer', minimum: 0 },
      progressPercent: { type: 'integer', minimum: 0, maximum: 100 },
    },
  },
  response: {
    200: { description: 'Task updated successfully' },
    401: responses[401], 403: responses[403], 404: responses[404], 409: responses[409], 500: responses[500],
  },
};

export const transitionTaskSchemaDoc = {
  tags: ['tasks'],
  summary: 'Transition task execution status',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'taskId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      taskId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'] },
    },
  },
  response: {
    200: { description: 'Task status transitioned' },
    401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

// ── Project Calendar Swagger Schemas ────────────────────────────────────────

export const getCalendarSchemaDoc = {
  tags: ['calendars'],
  summary: 'Get project working calendar',
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
    200: { description: 'Project working calendar details' },
    401: responses[401], 403: responses[403], 404: responses[404], 500: responses[500],
  },
};

export const updateCalendarSchemaDoc = {
  tags: ['calendars'],
  summary: 'Update project working calendar configuration',
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
    properties: {
      timezone: { type: 'string' },
      workingWeek: {
        type: 'array',
        items: { type: 'string', enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] },
      },
      hoursPerDay: { type: 'number', minimum: 1, maximum: 24 },
    },
  },
  response: {
    200: { description: 'Calendar updated' },
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

// ── Dependency Swagger Schemas ──────────────────────────────────────────────

export const createDependencySchemaDoc = {
  tags: ['dependencies'],
  summary: 'Create a task dependency with cycle detection & project lock',
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
    required: ['taskId', 'predecessorId'],
    properties: {
      taskId: { type: 'string' },
      predecessorId: { type: 'string' },
      type: { type: 'string', enum: ['FS', 'SS', 'FF', 'SF'] },
      lagDays: { type: 'integer', default: 0 },
    },
  },
  response: {
    201: { description: 'Dependency created' },
    400: responses[400], 401: responses[401], 403: responses[403], 422: responses[422], 500: responses[500],
  },
};

// ── Schedule Engine Swagger Schemas ─────────────────────────────────────────

export const recalculateScheduleSchemaDoc = {
  tags: ['schedule-engine'],
  summary: 'Recalculate critical path and CPM float for project tasks',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      expectedRevision: { type: 'integer' },
    },
  },
  response: {
    200: { description: 'Schedule recalculated' },
    401: responses[401], 403: responses[403], 409: responses[409], 422: responses[422], 500: responses[500],
  },
};

// ── Baseline Swagger Schemas ────────────────────────────────────────────────

export const createBaselineSchemaDoc = {
  tags: ['baselines'],
  summary: 'Create an immutable schedule baseline snapshot (DRAFT)',
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
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string' },
    },
  },
  response: {
    201: { description: 'Baseline created' },
    401: responses[401], 403: responses[403], 422: responses[422], 500: responses[500],
  },
};

export const activateBaselineSchemaDoc = {
  tags: ['baselines'],
  summary: 'Activate a baseline (supersedes existing ACTIVE baseline)',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'baselineId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      baselineId: { type: 'string' },
    },
  },
  response: {
    200: { description: 'Baseline activated' },
    401: responses[401], 403: responses[403], 404: responses[404], 422: responses[422], 500: responses[500],
  },
};

// ── Daily Field Logs Swagger Schemas ────────────────────────────────────────

export const createFieldLogSchemaDoc = {
  tags: ['field-logs'],
  summary: 'Create daily field execution log (DRAFT)',
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
    required: ['logDate'],
    properties: {
      logDate: { type: 'string', format: 'date' },
      notes: { type: 'string' },
    },
  },
  response: {
    201: { description: 'Field log created' },
    401: responses[401], 403: responses[403], 409: responses[409], 500: responses[500],
  },
};

// ── Issues & Impact Swagger Schemas ─────────────────────────────────────────

export const createIssueSchemaDoc = {
  tags: ['issues'],
  summary: 'Report an issue with reported schedule impact days',
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
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      reportedImpactDays: { type: 'integer', minimum: 0, default: 0 },
      assignedTo: { type: 'string' },
    },
  },
  response: {
    201: { description: 'Issue reported' },
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

// ── Schedule History Swagger Schemas ────────────────────────────────────────

export const getScheduleHistorySchemaDoc = {
  tags: ['schedule-history'],
  summary: 'Get append-only audit trail of schedule changes',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['organizationId', 'projectId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
    },
  },
  response: {
    200: { description: 'List of schedule change events' },
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};

// ── Schedule Metrics Swagger Schemas ────────────────────────────────────────

export const getScheduleMetricsSchemaDoc = {
  tags: ['schedule-metrics'],
  summary: 'Get schedule summary read model (revision-cached)',
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
    200: { description: 'Schedule summary metrics' },
    401: responses[401], 403: responses[403], 500: responses[500],
  },
};
