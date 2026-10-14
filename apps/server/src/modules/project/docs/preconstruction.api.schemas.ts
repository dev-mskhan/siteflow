// apps/server/src/modules/project/docs/preconstruction.api.schemas.ts
// Fastify JSON Schema definitions for OpenAPI/Swagger documentation
// covering the Preconstruction Proposal and Tender Management module.

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
  400: { description: 'Bad request', ...apiErrorSchema },
  401: { description: 'Unauthorized', ...apiErrorSchema },
  403: { description: 'Forbidden', ...apiErrorSchema },
  404: { description: 'Not found', ...apiErrorSchema },
  409: { description: 'Conflict / version conflict', ...apiErrorSchema },
  422: { description: 'Validation / invalid lifecycle transition', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

const orgParams = {
  type: 'object',
  required: ['organizationId'],
  properties: { organizationId: { type: 'string' } },
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
// SHARED DTO SHAPES
// ═══════════════════════════════════════════════════════════════════════════════

const commercialTermsDTOSchema = {
  type: ['object', 'null'],
  properties: {
    paymentTerms: { type: ['string', 'null'] },
    retentionPercent: { type: 'string' },
    liquidatedDamages: { type: ['string', 'null'] },
    bondRequirements: { type: ['string', 'null'] },
    insuranceRequirements: { type: ['string', 'null'] },
    otherTerms: { type: ['string', 'null'] },
  },
} as const;

const proposalLineDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    revisionId: { type: 'string' },
    sortOrder: { type: 'number' },
    itemKey: { type: 'string' },
    sectionKey: { type: ['string', 'null'] },
    description: { type: 'string' },
    specification: { type: ['string', 'null'] },
    unit: { type: 'string' },
    quantity: { type: 'string' },
    unitRate: { type: 'string' },
    amount: { type: 'string' },
    currencyCode: { type: 'string' },
    costCodeId: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id', 'revisionId', 'sortOrder', 'itemKey', 'description',
    'unit', 'quantity', 'unitRate', 'amount', 'currencyCode', 'createdAt',
  ],
} as const;

const proposalRevisionDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    proposalId: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    revisionNumber: { type: 'number' },
    status: {
      type: 'string',
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'SUPERSEDED'],
    },
    currencyCode: { type: 'string' },
    calculationVersion: { type: 'string' },
    taxPercent: { type: 'string' },
    taxSource: { type: ['string', 'null'] },
    overheadPercent: { type: 'string' },
    contingencyPercent: { type: 'string' },
    markupPercent: { type: 'string' },
    discountPercent: { type: 'string' },
    subtotalAmount: { type: 'string' },
    taxAmount: { type: 'string' },
    totalAmount: { type: 'string' },
    scope: { type: ['string', 'null'] },
    inclusions: { type: ['string', 'null'] },
    exclusions: { type: ['string', 'null'] },
    assumptions: { type: ['string', 'null'] },
    clarifications: { type: ['string', 'null'] },
    validUntil: { type: ['string', 'null'] },
    estimatedDurationDays: { type: ['number', 'null'] },
    scheduleSummary: { type: ['string', 'null'] },
    commercialTerms: commercialTermsDTOSchema,
    deliveryMethod: { type: 'string', enum: ['INTERNAL', 'EMAIL'] },
    deliveryNotes: { type: ['string', 'null'] },
    sourceEstimateId: { type: ['string', 'null'] },
    sourceEstimateRevisionId: { type: ['string', 'null'] },
    sourceBoqId: { type: ['string', 'null'] },
    sourceBoqRevisionId: { type: ['string', 'null'] },
    createdBy: { type: 'string' },
    submittedBy: { type: ['string', 'null'] },
    submittedAt: { type: ['string', 'null'], format: 'date-time' },
    approvedBy: { type: ['string', 'null'] },
    approvedAt: { type: ['string', 'null'], format: 'date-time' },
    issuedBy: { type: ['string', 'null'] },
    issuedAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id', 'proposalId', 'organizationId', 'projectId', 'revisionNumber',
    'status', 'currencyCode', 'calculationVersion',
    'taxPercent', 'overheadPercent', 'contingencyPercent', 'markupPercent', 'discountPercent',
    'subtotalAmount', 'taxAmount', 'totalAmount',
    'deliveryMethod', 'createdBy', 'createdAt',
  ],
} as const;

const proposalDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    tenderId: { type: ['string', 'null'] },
    proposalNumber: { type: 'string', example: 'PROP-202410-001' },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: [
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED',
        'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED',
      ],
    },
    currentRevisionNumber: { type: 'number' },
    version: { type: 'number' },
    clientName: { type: ['string', 'null'] },
    clientReference: { type: ['string', 'null'] },
    sourceEstimateId: { type: ['string', 'null'] },
    sourceEstimateRevisionId: { type: ['string', 'null'] },
    sourceBoqId: { type: ['string', 'null'] },
    sourceBoqRevisionId: { type: ['string', 'null'] },
    createdBy: { type: 'string' },
    submittedBy: { type: ['string', 'null'] },
    submittedAt: { type: ['string', 'null'], format: 'date-time' },
    approvedBy: { type: ['string', 'null'] },
    approvedAt: { type: ['string', 'null'], format: 'date-time' },
    rejectedBy: { type: ['string', 'null'] },
    rejectedAt: { type: ['string', 'null'], format: 'date-time' },
    rejectionReason: { type: ['string', 'null'] },
    issuedAt: { type: ['string', 'null'], format: 'date-time' },
    issuedBy: { type: ['string', 'null'] },
    acceptedAt: { type: ['string', 'null'], format: 'date-time' },
    acceptedBy: { type: ['string', 'null'] },
    clientResponseEvent: { type: ['string', 'null'] },
    clientResponseAt: { type: ['string', 'null'], format: 'date-time' },
    withdrawnAt: { type: ['string', 'null'], format: 'date-time' },
    expiredAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id', 'organizationId', 'projectId', 'proposalNumber', 'title', 'status',
    'currentRevisionNumber', 'version', 'createdBy', 'createdAt', 'updatedAt',
  ],
} as const;

const proposalDetailDTOSchema = {
  type: 'object',
  properties: {
    proposal: proposalDTOSchema,
    revision: proposalRevisionDTOSchema,
    lines: { type: 'array', items: proposalLineDTOSchema },
  },
  required: ['proposal', 'revision', 'lines'],
} as const;

const tenderDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    projectId: { type: ['string', 'null'] },
    tenderNumber: { type: 'number', example: 1 },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    clientName: { type: 'string' },
    clientReference: { type: ['string', 'null'] },
    issuerName: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: ['OPEN', 'SUBMITTED', 'AWARDED', 'LOST', 'WITHDRAWN', 'EXPIRED'],
    },
    submissionDeadline: { type: 'string', format: 'date-time' },
    submissionTimezone: { type: 'string' },
    requirements: { type: ['string', 'null'] },
    requiredDocuments: { type: ['array', 'null'], items: { type: 'string' } },
    estimatedValue: { type: ['string', 'null'] },
    currencyCode: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    version: { type: 'number' },
    createdBy: { type: 'string' },
    submittedAt: { type: ['string', 'null'], format: 'date-time' },
    awardedAt: { type: ['string', 'null'], format: 'date-time' },
    closedAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id', 'organizationId', 'tenderNumber', 'title', 'clientName',
    'status', 'submissionDeadline', 'submissionTimezone', 'version',
    'createdBy', 'createdAt', 'updatedAt',
  ],
} as const;

const proposalClientEventDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    proposalId: { type: 'string' },
    proposalRevisionId: { type: 'string' },
    event: { type: 'string' },
    clientSignatoryName: { type: ['string', 'null'] },
    responseReference: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    recordedBy: { type: 'string' },
    recordedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'proposalId', 'proposalRevisionId', 'event', 'recordedBy', 'recordedAt'],
} as const;

const proposalConversionDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    proposalId: { type: 'string' },
    proposalRevisionId: { type: 'string' },
    status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED'] },
    linkedProjectId: { type: ['string', 'null'] },
    failureReason: { type: ['string', 'null'] },
    createdBy: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    completedAt: { type: ['string', 'null'], format: 'date-time' },
    alreadyConverted: { type: 'boolean' },
  },
  required: ['id', 'proposalId', 'proposalRevisionId', 'status', 'createdBy', 'createdAt'],
} as const;

// ── Response wrappers ────────────────────────────────────────────────────────

function successOf(dataSchema: Record<string, unknown>) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: dataSchema,
    },
    required: ['success', 'data'],
  } as const;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TENDER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const createTenderSchemaDoc = {
  tags: ['Tenders'],
  summary: 'Create a tender opportunity',
  params: orgParams,
  body: {
    type: 'object',
    required: ['title', 'clientName', 'submissionDeadline', 'submissionTimezone'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 160 },
      description: { type: ['string', 'null'], maxLength: 5000 },
      clientName: { type: 'string', minLength: 1, maxLength: 200 },
      clientReference: { type: ['string', 'null'], maxLength: 200 },
      issuerName: { type: ['string', 'null'], maxLength: 200 },
      projectId: { type: ['string', 'null'] },
      submissionDeadline: { type: 'string', format: 'date-time' },
      submissionTimezone: { type: 'string', minLength: 1, maxLength: 100 },
      requirements: { type: ['string', 'null'], maxLength: 5000 },
      requiredDocuments: { type: 'array', items: { type: 'string' }, maxItems: 50 },
      estimatedValue: { type: ['string', 'null'] },
      currencyCode: { type: ['string', 'null'], pattern: '^[A-Z]{3}$' },
      notes: { type: ['string', 'null'], maxLength: 2000 },
    },
  },
  response: {
    201: successOf({ type: 'object', properties: { tender: tenderDTOSchema }, required: ['tender'] }),
    ...stdResponses,
  },
} as const;

export const listTendersSchemaDoc = {
  tags: ['Tenders'],
  summary: 'List tender opportunities for an organization',
  params: orgParams,
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'number', minimum: 1, maximum: 100, default: 25 },
      cursor: { type: 'string', maxLength: 256 },
      status: { type: 'string', enum: ['OPEN', 'SUBMITTED', 'AWARDED', 'LOST', 'WITHDRAWN', 'EXPIRED'] },
    },
  },
  response: {
    200: successOf({
      type: 'object',
      properties: {
        items: { type: 'array', items: tenderDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    }),
    ...stdResponses,
  },
} as const;

export const getTenderSchemaDoc = {
  tags: ['Tenders'],
  summary: 'Get a tender opportunity',
  params: {
    ...orgParams,
    properties: { ...orgParams.properties, tenderId: { type: 'string' } },
    required: [...orgParams.required, 'tenderId'] as const,
  },
  response: {
    200: successOf({ type: 'object', properties: { tender: tenderDTOSchema }, required: ['tender'] }),
    ...stdResponses,
  },
} as const;

export const updateTenderSchemaDoc = {
  tags: ['Tenders'],
  summary: 'Update a tender opportunity',
  params: {
    type: 'object',
    required: ['organizationId', 'tenderId'],
    properties: { organizationId: { type: 'string' }, tenderId: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['title', 'clientName', 'submissionDeadline', 'submissionTimezone', 'expectedVersion'],
    properties: {
      expectedVersion: { type: 'number', minimum: 1 },
      title: { type: 'string', minLength: 1, maxLength: 160 },
      clientName: { type: 'string', minLength: 1, maxLength: 200 },
      submissionDeadline: { type: 'string', format: 'date-time' },
      submissionTimezone: { type: 'string' },
    },
  },
  response: {
    200: successOf({ type: 'object', properties: { tender: tenderDTOSchema }, required: ['tender'] }),
    ...stdResponses,
  },
} as const;

const tenderTransitionBody = {
  type: 'object',
  required: ['expectedVersion'],
  properties: { expectedVersion: { type: 'number', minimum: 1 } },
} as const;

const tenderTransitionParams = {
  type: 'object',
  required: ['organizationId', 'tenderId'],
  properties: { organizationId: { type: 'string' }, tenderId: { type: 'string' } },
} as const;

const tenderResponse = successOf({ type: 'object', properties: { tender: tenderDTOSchema }, required: ['tender'] });

export const submitTenderSchemaDoc = {
  tags: ['Tenders'], summary: 'Mark tender as submitted (OPEN→SUBMITTED)',
  params: tenderTransitionParams, body: tenderTransitionBody,
  response: { 200: tenderResponse, ...stdResponses },
} as const;

export const awardTenderSchemaDoc = {
  tags: ['Tenders'], summary: 'Mark tender as awarded (SUBMITTED→AWARDED)',
  params: tenderTransitionParams, body: tenderTransitionBody,
  response: { 200: tenderResponse, ...stdResponses },
} as const;

export const lostTenderSchemaDoc = {
  tags: ['Tenders'], summary: 'Mark tender as lost (SUBMITTED→LOST)',
  params: tenderTransitionParams, body: tenderTransitionBody,
  response: { 200: tenderResponse, ...stdResponses },
} as const;

export const withdrawTenderSchemaDoc = {
  tags: ['Tenders'], summary: 'Withdraw a tender (OPEN|SUBMITTED→WITHDRAWN)',
  params: tenderTransitionParams, body: tenderTransitionBody,
  response: { 200: tenderResponse, ...stdResponses },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// PROPOSAL SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const proposalParams = {
  type: 'object',
  required: ['organizationId', 'projectId', 'proposalId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    proposalId: { type: 'string' },
  },
} as const;

const proposalTransitionBody = {
  type: 'object',
  required: ['expectedVersion'],
  properties: { expectedVersion: { type: 'number', minimum: 1 } },
} as const;

const proposalDetailResponse = successOf(proposalDetailDTOSchema);

export const createProposalSchemaDoc = {
  tags: ['Proposals'],
  summary: 'Create a proposal (DRAFT)',
  params: orgProjectParams,
  body: {
    type: 'object',
    required: ['title', 'currencyCode', 'lines'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 160 },
      description: { type: ['string', 'null'], maxLength: 5000 },
      tenderId: { type: ['string', 'null'] },
      clientName: { type: ['string', 'null'], maxLength: 200 },
      clientReference: { type: ['string', 'null'], maxLength: 200 },
      scope: { type: ['string', 'null'], maxLength: 5000 },
      inclusions: { type: ['string', 'null'], maxLength: 5000 },
      exclusions: { type: ['string', 'null'], maxLength: 5000 },
      assumptions: { type: ['string', 'null'], maxLength: 5000 },
      clarifications: { type: ['string', 'null'], maxLength: 5000 },
      sourceEstimateId: { type: ['string', 'null'] },
      sourceEstimateRevisionId: { type: ['string', 'null'] },
      sourceBoqId: { type: ['string', 'null'] },
      sourceBoqRevisionId: { type: ['string', 'null'] },
      currencyCode: { type: 'string', pattern: '^[A-Z]{3}$' },
      taxPercent: { type: 'string', default: '0' },
      taxSource: { type: ['string', 'null'], maxLength: 500 },
      overheadPercent: { type: 'string', default: '0' },
      contingencyPercent: { type: 'string', default: '0' },
      markupPercent: { type: 'string', default: '0' },
      discountPercent: { type: 'string', default: '0' },
      validUntil: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      estimatedDurationDays: { type: ['number', 'null'], minimum: 1, maximum: 9999 },
      lines: { type: 'array', maxItems: 1000, items: { type: 'object' } },
    },
  },
  response: {
    201: proposalDetailResponse,
    ...stdResponses,
  },
} as const;

export const listProposalsSchemaDoc = {
  tags: ['Proposals'],
  summary: 'List proposals for a project',
  params: orgProjectParams,
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'number', minimum: 1, maximum: 100, default: 25 },
      cursor: { type: 'string', maxLength: 256 },
      status: {
        type: 'string',
        enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'],
      },
      tenderId: { type: 'string' },
    },
  },
  response: {
    200: successOf({
      type: 'object',
      properties: {
        items: { type: 'array', items: proposalDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    }),
    ...stdResponses,
  },
} as const;

export const getProposalSchemaDoc = {
  tags: ['Proposals'], summary: 'Get a proposal with current revision and lines',
  params: proposalParams, response: { 200: proposalDetailResponse, ...stdResponses },
} as const;

export const updateProposalSchemaDoc = {
  tags: ['Proposals'], summary: 'Update a draft/rejected proposal (creates new revision)',
  params: proposalParams,
  body: {
    type: 'object',
    required: ['title', 'currencyCode', 'lines', 'expectedVersion'],
    properties: {
      expectedVersion: { type: 'number', minimum: 1 },
      title: { type: 'string', minLength: 1, maxLength: 160 },
      currencyCode: { type: 'string', pattern: '^[A-Z]{3}$' },
      lines: { type: 'array', maxItems: 1000, items: { type: 'object' } },
    },
  },
  response: { 200: proposalDetailResponse, ...stdResponses },
} as const;

export const submitProposalSchemaDoc = {
  tags: ['Proposals'], summary: 'Submit proposal for internal approval (DRAFT→PENDING_APPROVAL)',
  params: proposalParams, body: proposalTransitionBody,
  response: { 200: proposalDetailResponse, ...stdResponses },
} as const;

export const approveProposalSchemaDoc = {
  tags: ['Proposals'], summary: 'Internally approve a proposal (PENDING_APPROVAL→APPROVED)',
  params: proposalParams, body: proposalTransitionBody,
  response: { 200: proposalDetailResponse, ...stdResponses },
} as const;

export const rejectProposalSchemaDoc = {
  tags: ['Proposals'], summary: 'Internally reject a proposal (PENDING_APPROVAL→REJECTED)',
  params: proposalParams,
  body: {
    type: 'object',
    required: ['expectedVersion', 'reason'],
    properties: {
      expectedVersion: { type: 'number', minimum: 1 },
      reason: { type: 'string', minLength: 10, maxLength: 500 },
    },
  },
  response: { 200: proposalDetailResponse, ...stdResponses },
} as const;

export const issueProposalSchemaDoc = {
  tags: ['Proposals'], summary: 'Issue an approved proposal to the client (APPROVED→ISSUED)',
  params: proposalParams,
  body: {
    type: 'object',
    required: ['expectedVersion'],
    properties: {
      expectedVersion: { type: 'number', minimum: 1 },
      deliveryMethod: { type: 'string', enum: ['INTERNAL', 'EMAIL'], default: 'INTERNAL' },
      deliveryNotes: { type: ['string', 'null'], maxLength: 1000 },
    },
  },
  response: { 200: proposalDetailResponse, ...stdResponses },
} as const;

export const recordClientResponseSchemaDoc = {
  tags: ['Proposals'],
  summary: 'Record a verified client response on an issued proposal (ISSUED→ACCEPTED|REJECTED)',
  params: proposalParams,
  body: {
    type: 'object',
    required: ['expectedVersion', 'event'],
    properties: {
      expectedVersion: { type: 'number', minimum: 1 },
      event: { type: 'string', enum: ['ACCEPTED', 'REJECTED'] },
      clientSignatoryName: { type: ['string', 'null'], maxLength: 200 },
      responseReference: { type: ['string', 'null'], maxLength: 200 },
      notes: { type: ['string', 'null'], maxLength: 2000 },
    },
  },
  response: { 200: proposalDetailResponse, ...stdResponses },
} as const;

export const withdrawProposalSchemaDoc = {
  tags: ['Proposals'], summary: 'Withdraw a proposal',
  params: proposalParams,
  body: {
    type: 'object',
    required: ['expectedVersion', 'reason'],
    properties: {
      expectedVersion: { type: 'number', minimum: 1 },
      reason: { type: 'string', minLength: 1, maxLength: 500 },
    },
  },
  response: { 200: proposalDetailResponse, ...stdResponses },
} as const;

export const listProposalRevisionsSchemaDoc = {
  tags: ['Proposals'], summary: 'List all revisions of a proposal',
  params: proposalParams,
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'number', minimum: 1, maximum: 100, default: 25 },
      cursor: { type: 'string', maxLength: 256 },
    },
  },
  response: {
    200: successOf({
      type: 'object',
      properties: {
        items: { type: 'array', items: proposalRevisionDTOSchema },
        nextCursor: { type: ['string', 'null'] },
      },
      required: ['items', 'nextCursor'],
    }),
    ...stdResponses,
  },
} as const;

export const getProposalRevisionSchemaDoc = {
  tags: ['Proposals'], summary: 'Get a specific proposal revision with its lines',
  params: {
    type: 'object',
    required: ['organizationId', 'projectId', 'proposalId', 'revisionId'],
    properties: {
      organizationId: { type: 'string' },
      projectId: { type: 'string' },
      proposalId: { type: 'string' },
      revisionId: { type: 'string' },
    },
  },
  response: {
    200: successOf({
      type: 'object',
      properties: {
        revision: proposalRevisionDTOSchema,
        lines: { type: 'array', items: proposalLineDTOSchema },
      },
      required: ['revision', 'lines'],
    }),
    ...stdResponses,
  },
} as const;

export const listClientEventsSchemaDoc = {
  tags: ['Proposals'], summary: 'List all client response events for a proposal',
  params: proposalParams,
  response: {
    200: successOf({
      type: 'object',
      properties: { events: { type: 'array', items: proposalClientEventDTOSchema } },
      required: ['events'],
    }),
    ...stdResponses,
  },
} as const;

export const convertProposalSchemaDoc = {
  tags: ['Proposals'],
  summary: 'Start idempotent conversion of an accepted proposal into a project (202 = pending, 200 = already converted)',
  params: proposalParams,
  body: {
    type: 'object',
    required: ['expectedVersion', 'idempotencyKey', 'projectName'],
    properties: {
      expectedVersion: { type: 'number', minimum: 1 },
      idempotencyKey: { type: 'string', minLength: 1, maxLength: 255 },
      projectName: { type: 'string', minLength: 1, maxLength: 160 },
      projectType: {
        type: ['string', 'null'],
        enum: ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER', null],
      },
      plannedStartDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    },
  },
  response: {
    200: successOf({
      type: 'object',
      properties: {
        conversion: proposalConversionDTOSchema,
        alreadyConverted: { type: 'boolean' },
      },
      required: ['conversion', 'alreadyConverted'],
    }),
    202: successOf({
      type: 'object',
      properties: {
        conversion: proposalConversionDTOSchema,
        alreadyConverted: { type: 'boolean' },
      },
      required: ['conversion', 'alreadyConverted'],
    }),
    ...stdResponses,
  },
} as const;
