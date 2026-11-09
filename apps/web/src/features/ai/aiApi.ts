/**
 * aiApi — RTK Query endpoints for the AI module.
 *
 * Backend endpoints (all require ai.runs.create or ai.runs.read permission):
 *   POST   /:orgId/ai/conversations              — create conversation
 *   GET    /:orgId/ai/conversations               — list conversations
 *   GET    /:orgId/ai/conversations/:convId       — get one conversation
 *   DELETE /:orgId/ai/conversations/:convId        — archive conversation
 *   POST   /:orgId/ai/conversations/:convId/messages — send message (triggers run)
 *   GET    /:orgId/ai/conversations/:convId/messages — list messages
 *   POST   /:orgId/ai/runs                         — start a direct run
 *   GET    /:orgId/ai/runs                         — list runs
 *   GET    /:orgId/ai/runs/:runId                   — get run status
 *   DELETE /:orgId/ai/runs/:runId                   — cancel run
 *   GET    /:orgId/ai/approvals/:approvalId        — get approval
 *   POST   /:orgId/ai/approvals/:approvalId/approve — approve
 *   POST   /:orgId/ai/approvals/:approvalId/reject  — reject
 *   GET    /:orgId/okf/pages                       — list knowledge pages
 *   POST   /:orgId/okf/pages/:pageId/approve       — approve OKF page
 *   POST   /:orgId/okf/pages/:pageId/reject        — reject OKF page
 */
import { baseApi } from '../../services/baseApi';
import type { ApiResponse } from '../../services/baseApi';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AIConversation {
  id: string;
  organizationId: string;
  projectId: string | null;
  agent: string;
  title: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  channel: 'chat' | 'voice' | 'api';
  content: string;
  runId: string | null;
  createdAt: string;
}

export interface AIRun {
  id: string;
  organizationId: string;
  projectId: string | null;
  agent: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'AWAITING_APPROVAL';
  channel: 'api' | 'chat' | 'voice';
  trigger: string;
  inputSnapshot: Record<string, unknown> | null;
  outputSnapshot: Record<string, unknown> | null;
  error: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: string | null;
  traceId: string | null;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AIApproval {
  id: string;
  runId: string;
  organizationId: string;
  proposalType: string;
  proposal: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  approvedToolName: string | null;
  approvedArgsHash: string | null;
  expiresAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface OKFPage {
  id: string;
  organizationId: string;
  pagePath: string;
  title: string;
  content: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

// ─── Helper to unwrap ApiResponse envelopes ──────────────────────────────────

function unwrap<T>(resp: ApiResponse<T>): T {
  if (resp.success) return resp.data;
  throw new Error(resp.error.message);
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Conversations ───────────────────────────────────────────────────────
    listConversations: builder.query<AIConversation[], { orgId: string }>({
      query: ({ orgId }) => `/organizations/${orgId}/ai/conversations`,
      transformResponse: (resp: ApiResponse<AIConversation[]>) => unwrap(resp),
      providesTags: ['AgentRun'],
    }),

    createConversation: builder.mutation<
      AIConversation,
      { orgId: string; agent: string; projectId?: string; title?: string }
    >({
      query: ({ orgId, ...body }) => ({
        url: `/organizations/${orgId}/ai/conversations`,
        method: 'POST',
        body,
      }),
      transformResponse: (resp: ApiResponse<AIConversation>) => unwrap(resp),
      invalidatesTags: ['AgentRun'],
    }),

    getConversation: builder.query<AIConversation, { orgId: string; conversationId: string }>({
      query: ({ orgId, conversationId }) =>
        `/organizations/${orgId}/ai/conversations/${conversationId}`,
      transformResponse: (resp: ApiResponse<AIConversation>) => unwrap(resp),
      providesTags: ['AgentRun'],
    }),

    // ── Messages ───────────────────────────────────────────────────────────
    listMessages: builder.query<AIMessage[], { orgId: string; conversationId: string }>({
      query: ({ orgId, conversationId }) =>
        `/organizations/${orgId}/ai/conversations/${conversationId}/messages`,
      transformResponse: (resp: ApiResponse<AIMessage[]>) => unwrap(resp),
      providesTags: ['AgentRun'],
    }),

    sendMessage: builder.mutation<
      AIMessage,
      { orgId: string; conversationId: string; content: string; channel?: string }
    >({
      query: ({ orgId, conversationId, content, channel = 'chat' }) => ({
        url: `/organizations/${orgId}/ai/conversations/${conversationId}/messages`,
        method: 'POST',
        body: { content, channel },
      }),
      transformResponse: (resp: ApiResponse<AIMessage>) => unwrap(resp),
      invalidatesTags: ['AgentRun'],
    }),

    // ── Runs ───────────────────────────────────────────────────────────────
    listRuns: builder.query<
      AIRun[],
      { orgId: string; status?: string; agent?: string; limit?: number }
    >({
      query: ({ orgId, ...params }) => ({
        url: `/organizations/${orgId}/ai/runs`,
        params,
      }),
      transformResponse: (resp: ApiResponse<AIRun[]>) => unwrap(resp),
      providesTags: ['AgentRun'],
    }),

    getRun: builder.query<AIRun, { orgId: string; runId: string }>({
      query: ({ orgId, runId }) => `/organizations/${orgId}/ai/runs/${runId}`,
      transformResponse: (resp: ApiResponse<AIRun>) => unwrap(resp),
      providesTags: ['AgentRun'],
    }),

    cancelRun: builder.mutation<void, { orgId: string; runId: string }>({
      query: ({ orgId, runId }) => ({
        url: `/organizations/${orgId}/ai/runs/${runId}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: ['AgentRun'],
    }),

    // ── Approvals ──────────────────────────────────────────────────────────
    getApproval: builder.query<AIApproval, { orgId: string; approvalId: string }>({
      query: ({ orgId, approvalId }) =>
        `/organizations/${orgId}/ai/approvals/${approvalId}`,
      transformResponse: (resp: ApiResponse<AIApproval>) => unwrap(resp),
      providesTags: ['AgentRun'],
    }),

    approveAction: builder.mutation<
      void,
      { orgId: string; approvalId: string; note?: string }
    >({
      query: ({ orgId, approvalId, note }) => ({
        url: `/organizations/${orgId}/ai/approvals/${approvalId}/approve`,
        method: 'POST',
        body: { note },
      }),
      invalidatesTags: ['AgentRun'],
    }),

    rejectAction: builder.mutation<
      void,
      { orgId: string; approvalId: string; note?: string }
    >({
      query: ({ orgId, approvalId, note }) => ({
        url: `/organizations/${orgId}/ai/approvals/${approvalId}/reject`,
        method: 'POST',
        body: { note },
      }),
      invalidatesTags: ['AgentRun'],
    }),

    // ── OKF Knowledge Pages ─────────────────────────────────────────────────
    listOKFPages: builder.query<OKFPage[], { orgId: string }>({
      query: ({ orgId }) => `/organizations/${orgId}/okf/pages`,
      transformResponse: (resp: ApiResponse<OKFPage[]>) => unwrap(resp),
      providesTags: ['AgentRun'],
    }),

    approveOKFPage: builder.mutation<void, { orgId: string; pageId: string }>({
      query: ({ orgId, pageId }) => ({
        url: `/organizations/${orgId}/okf/pages/${pageId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['AgentRun'],
    }),

    rejectOKFPage: builder.mutation<void, { orgId: string; pageId: string }>({
      query: ({ orgId, pageId }) => ({
        url: `/organizations/${orgId}/okf/pages/${pageId}/reject`,
        method: 'POST',
      }),
      invalidatesTags: ['AgentRun'],
    }),
  }),
});

export const {
  useListConversationsQuery,
  useCreateConversationMutation,
  useGetConversationQuery,
  useListMessagesQuery,
  useSendMessageMutation,
  useListRunsQuery,
  useGetRunQuery,
  useCancelRunMutation,
  useGetApprovalQuery,
  useApproveActionMutation,
  useRejectActionMutation,
  useListOKFPagesQuery,
  useApproveOKFPageMutation,
  useRejectOKFPageMutation,
} = aiApi;
