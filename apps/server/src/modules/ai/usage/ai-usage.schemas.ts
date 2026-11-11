// apps/server/src/modules/ai/usage/ai-usage.schemas.ts
// Phase 11.2 — OpenAPI Schema Documentation for AI Usage API

/**
 * GET /:organizationId/ai/usage/current
 * Current billing month usage summary.
 */
export const getCurrentUsageSchemaDoc = {
  tags: ['ai-usage'],
  summary: 'Get current month AI usage',
  description:
    'Returns AI token usage summary for the current billing month. ' +
    'Includes total tokens used, monthly limit, percentage used, cost, and reset date. ' +
    'Q3 Decision: All members can view usage (transparent awareness).',
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: {
      organizationId: {
        type: 'string',
        format: 'uuid',
        description: 'Organization ID',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      description: 'Current month usage summary',
      required: ['data'],
      properties: {
        data: {
          type: 'object',
          required: ['usage'],
          properties: {
            usage: {
              type: 'object',
              required: [
                'used',
                'limit',
                'remaining',
                'percentUsed',
                'isNearLimit',
                'resetDate',
                'costUsd',
                'runCount',
                'successfulRuns',
                'failedRuns',
                'daysWithUsage',
              ],
              properties: {
                used: {
                  type: 'number',
                  description: 'Total tokens consumed this billing month',
                  example: 125000,
                },
                limit: {
                  type: 'number',
                  description: 'Monthly token limit based on subscription plan',
                  example: 500000,
                },
                remaining: {
                  type: 'number',
                  description: 'Tokens remaining in this billing month',
                  example: 375000,
                },
                percentUsed: {
                  type: 'number',
                  description: 'Percentage of monthly limit used (0-100)',
                  example: 25.0,
                },
                isNearLimit: {
                  type: 'boolean',
                  description: 'True if usage is >= 90% of monthly limit',
                  example: false,
                },
                resetDate: {
                  type: 'string',
                  format: 'date-time',
                  description: 'When the usage limit resets (first day of next month UTC)',
                  example: '2027-03-01T00:00:00.000Z',
                },
                costUsd: {
                  type: 'string',
                  description: 'Total USD cost for this billing month (6 decimal precision)',
                  example: '0.250000',
                },
                runCount: {
                  type: 'number',
                  description: 'Total AI runs this month',
                  example: 15,
                },
                successfulRuns: {
                  type: 'number',
                  description: 'Successful runs this month',
                  example: 14,
                },
                failedRuns: {
                  type: 'number',
                  description: 'Failed runs this month',
                  example: 1,
                },
                daysWithUsage: {
                  type: 'number',
                  description: 'Number of days with AI usage this month',
                  example: 5,
                },
              },
            },
          },
        },
      },
    },
    403: {
      type: 'object',
      description: 'No active subscription or trial',
      properties: {
        error: { type: 'string', example: 'NO_ACTIVE_SUBSCRIPTION' },
        message: { type: 'string', example: 'No active subscription or trial found. AI features require an active plan.' },
      },
    },
  },
} as const;

/**
 * GET /:organizationId/ai/usage/history
 * Historical daily usage data for charting.
 */
export const getUsageHistorySchemaDoc = {
  tags: ['ai-usage'],
  summary: 'Get AI usage history',
  description:
    'Returns daily AI token usage records for a specified date range (max 90 days). ' +
    'Used for building usage charts and analytics dashboards.',
  params: {
    type: 'object',
    required: ['organizationId'],
    properties: {
      organizationId: {
        type: 'string',
        format: 'uuid',
        description: 'Organization ID',
      },
    },
  },
  querystring: {
    type: 'object',
    required: ['startDate', 'endDate'],
    properties: {
      startDate: {
        type: 'string',
        format: 'date',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'Start date in YYYY-MM-DD format (inclusive)',
        example: '2027-02-01',
      },
      endDate: {
        type: 'string',
        format: 'date',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'End date in YYYY-MM-DD format (inclusive)',
        example: '2027-02-28',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 90,
        description: 'Maximum number of days to return (optional)',
        example: 30,
      },
    },
  },
  response: {
    200: {
      type: 'object',
      description: 'Daily usage history',
      required: ['data'],
      properties: {
        data: {
          type: 'object',
          required: ['history', 'meta'],
          properties: {
            history: {
              type: 'array',
              description: 'Daily usage records ordered by date ascending',
              items: {
                type: 'object',
                required: [
                  'date',
                  'totalTokens',
                  'tokensIn',
                  'tokensOut',
                  'costUsd',
                  'runCount',
                  'successfulRuns',
                  'failedRuns',
                ],
                properties: {
                  date: {
                    type: 'string',
                    format: 'date',
                    description: 'Usage date in YYYY-MM-DD format',
                    example: '2027-02-15',
                  },
                  totalTokens: {
                    type: 'number',
                    description: 'Total tokens used on this day',
                    example: 8500,
                  },
                  tokensIn: {
                    type: 'number',
                    description: 'Input tokens (prompts) on this day',
                    example: 3200,
                  },
                  tokensOut: {
                    type: 'number',
                    description: 'Output tokens (completions) on this day',
                    example: 5300,
                  },
                  costUsd: {
                    type: 'string',
                    description: 'USD cost for this day (6 decimal precision)',
                    example: '0.017500',
                  },
                  runCount: {
                    type: 'number',
                    description: 'Total AI runs on this day',
                    example: 3,
                  },
                  successfulRuns: {
                    type: 'number',
                    description: 'Successful runs on this day',
                    example: 3,
                  },
                  failedRuns: {
                    type: 'number',
                    description: 'Failed runs on this day',
                    example: 0,
                  },
                },
              },
            },
            meta: {
              type: 'object',
              required: ['startDate', 'endDate', 'totalDays', 'returned'],
              properties: {
                startDate: {
                  type: 'string',
                  format: 'date',
                  description: 'Requested start date',
                  example: '2027-02-01',
                },
                endDate: {
                  type: 'string',
                  format: 'date',
                  description: 'Requested end date',
                  example: '2027-02-28',
                },
                totalDays: {
                  type: 'number',
                  description: 'Total days with usage data in the range',
                  example: 28,
                },
                returned: {
                  type: 'number',
                  description: 'Number of records returned (after limit applied)',
                  example: 28,
                },
              },
            },
          },
        },
      },
    },
    400: {
      type: 'object',
      description: 'Invalid request parameters',
      properties: {
        error: {
          type: 'string',
          enum: ['INVALID_PARAMETERS', 'INVALID_DATE_FORMAT', 'INVALID_DATE_RANGE', 'DATE_RANGE_TOO_LARGE'],
          example: 'INVALID_DATE_FORMAT',
        },
        message: {
          type: 'string',
          example: 'Dates must be in YYYY-MM-DD format.',
        },
      },
    },
    403: {
      type: 'object',
      description: 'No active subscription or trial',
      properties: {
        error: { type: 'string', example: 'NO_ACTIVE_SUBSCRIPTION' },
        message: { type: 'string', example: 'No active subscription or trial found. AI features require an active plan.' },
      },
    },
  },
} as const;
