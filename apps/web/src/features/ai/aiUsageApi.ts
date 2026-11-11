// apps/web/src/features/ai/aiUsageApi.ts
// Phase 11.3 — AI Usage API (RTK Query)
// Fetches AI token usage data for dashboard components.

import { baseApi } from '../../services/baseApi';
import type { ApiResponse } from '../../services/baseApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UsageSummary {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  isNearLimit: boolean;
  resetDate: string; // ISO 8601
  costUsd: string;
  runCount: number;
  successfulRuns: number;
  failedRuns: number;
  daysWithUsage: number;
}

export interface DailyUsageRecord {
  date: string; // YYYY-MM-DD
  totalTokens: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: string;
  runCount: number;
  successfulRuns: number;
  failedRuns: number;
}

export interface UsageHistoryResponse {
  history: DailyUsageRecord[];
  meta: {
    startDate: string;
    endDate: string;
    totalDays: number;
    returned: number;
  };
}

// ── API Slice ─────────────────────────────────────────────────────────────────

export const aiUsageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * GET /organizations/:organizationId/ai/usage/current
     * Fetches current billing month AI usage summary.
     */
    getCurrentAIUsage: builder.query<UsageSummary, { organizationId: string }>({
      query: ({ organizationId }) => `/organizations/${organizationId}/ai/usage/current`,
      transformResponse: (response: ApiResponse<{ usage: UsageSummary }>) => {
        if (!response.success) {
          throw new Error(response.error.message);
        }
        return response.data.usage;
      },
      // Refetch every 30 seconds when component is mounted
      pollingInterval: 30000,
      // Provide tags for invalidation
      providesTags: (result, error, { organizationId }) => [
        { type: 'AIUsage' as const, id: organizationId },
      ],
    }),

    /**
     * GET /organizations/:organizationId/ai/usage/history?startDate&endDate
     * Fetches daily usage records for the specified date range.
     */
    getAIUsageHistory: builder.query<
      UsageHistoryResponse,
      { organizationId: string; startDate: string; endDate: string; limit?: number }
    >({
      query: ({ organizationId, startDate, endDate, limit }) => {
        const params = new URLSearchParams({
          startDate,
          endDate,
          ...(limit && { limit: limit.toString() }),
        });
        return `/organizations/${organizationId}/ai/usage/history?${params}`;
      },
      transformResponse: (response: ApiResponse<UsageHistoryResponse>) => {
        if (!response.success) {
          throw new Error(response.error.message);
        }
        return response.data;
      },
      providesTags: (result, error, { organizationId }) => [
        { type: 'AIUsageHistory' as const, id: organizationId },
      ],
    }),
  }),
});

// ── Hooks ─────────────────────────────────────────────────────────────────────

export const { useGetCurrentAIUsageQuery, useGetAIUsageHistoryQuery } = aiUsageApi;

// Add new tag types to baseApi
declare module '../../services/baseApi' {
  export interface TagTypes {
    AIUsage: { type: 'AIUsage'; id: string };
    AIUsageHistory: { type: 'AIUsageHistory'; id: string };
  }
}
