export {
  estimateDraftSchema,
  createEstimateSchema,
  updateEstimateSchema,
  transitionEstimateSchema,
  rejectEstimateSchema,
  estimateParamsSchema,
  estimateListQuerySchema,
  estimateCompareQuerySchema,
} from '@siteflow/shared';
export type {
  CreateEstimateInput,
  UpdateEstimateInput,
  EstimateTransitionInput,
  EstimateRejectInput,
} from '@siteflow/shared';

const estimateParams = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    estimateId: { type: 'string' },
  },
} as const;

const base = {
  tags: ['estimates'] as string[],
  security: [{ bearerAuth: [] as string[] }],
  params: estimateParams,
};

export const estimateRouteDocs = {
  create: { ...base, summary: 'Create a new cost estimate' },
  list: { ...base, summary: 'List cost estimates for a project' },
  get: { ...base, summary: 'Get a specific cost estimate by ID' },
  update: { ...base, summary: 'Update a draft cost estimate' },
  compare: { ...base, summary: 'Compare estimate figures against actuals or baseline' },
  submit: { ...base, summary: 'Submit estimate for review/approval' },
  approve: { ...base, summary: 'Approve a cost estimate' },
  reject: { ...base, summary: 'Reject a cost estimate' },
} as const;
