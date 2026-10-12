/**
 * Auth RTK Query API slice
 * Injected into the siteflowApi base.
 *
 * Endpoints mirror the Fastify /api/v1/auth/* routes exactly:
 *   POST /login           → useLoginMutation
 *   POST /register        → useRegisterMutation
 *   GET  /me              → useGetMeQuery
 *   POST /logout          → useLogoutMutation
 *   POST /logout-all      → useLogoutAllMutation
 *   POST /refresh         → useRefreshMutation
 *   POST /verify-email    → useVerifyEmailMutation
 *   POST /resend-verification → useResendVerificationMutation
 *   POST /forgot-password → useForgotPasswordMutation
 *   POST /reset-password  → useResetPasswordMutation
 *   POST /change-password → useChangePasswordMutation
 *   GET  /sessions        → useGetSessionsQuery
 *   DELETE /sessions/:id  → useDeleteSessionMutation
 *   POST /logout-all      → useLogoutAllMutation
 *   POST /invitations/:token/accept → useAcceptInvitationMutation
 */

import { siteflowApi } from '../../../lib/store/api';
import type {
  UserDTO,
  SessionDTO,
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
} from '@siteflow/shared';

interface AuthResponse {
  user: UserDTO;
}

interface MessageResponse {
  message: string;
}

interface SessionsResponse {
  sessions: SessionDTO[];
  nextCursor?: string;
}

interface InvitationAcceptResponse {
  organizationId: string;
  roleName: string;
}

export const authApi = siteflowApi.injectEndpoints({
  endpoints: (build) => ({
    /** GET /auth/me — check current session */
    getMe: build.query<UserDTO, void>({
      query: () => '/auth/me',
      transformResponse: (res: AuthResponse) => res.user,
      providesTags: ['Auth'],
    }),

    /** POST /auth/login */
    login: build.mutation<UserDTO, LoginInput>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (res: AuthResponse) => res.user,
      invalidatesTags: ['Auth', 'Session'],
    }),

    /** POST /auth/register */
    register: build.mutation<UserDTO, RegisterInput>({
      query: (data) => ({
        url: '/auth/register',
        method: 'POST',
        body: data,
      }),
      transformResponse: (res: AuthResponse) => res.user,
      invalidatesTags: ['Auth'],
    }),

    /** POST /auth/logout */
    logout: build.mutation<MessageResponse, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth', 'Session'],
    }),

    /** POST /auth/logout-all */
    logoutAll: build.mutation<MessageResponse, void>({
      query: () => ({ url: '/auth/logout-all', method: 'POST' }),
      invalidatesTags: ['Auth', 'Session'],
    }),

    /** POST /auth/refresh */
    refresh: build.mutation<MessageResponse, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
      invalidatesTags: ['Auth'],
    }),

    /** POST /auth/verify-email */
    verifyEmail: build.mutation<MessageResponse, { token: string }>({
      query: ({ token }) => ({
        url: '/auth/verify-email',
        method: 'POST',
        body: { token },
      }),
      invalidatesTags: ['Auth'],
    }),

    /** POST /auth/resend-verification */
    resendVerification: build.mutation<MessageResponse, { email: string }>({
      query: ({ email }) => ({
        url: '/auth/resend-verification',
        method: 'POST',
        body: { email },
      }),
    }),

    /** POST /auth/forgot-password */
    forgotPassword: build.mutation<MessageResponse, { email: string }>({
      query: ({ email }) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: { email },
      }),
    }),

    /** POST /auth/reset-password */
    resetPassword: build.mutation<MessageResponse, { token: string; newPassword: string }>({
      query: (body) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body,
      }),
    }),

    /** POST /auth/change-password */
    changePassword: build.mutation<MessageResponse, ChangePasswordInput>({
      query: (body) => ({
        url: '/auth/change-password',
        method: 'POST',
        body,
      }),
    }),

    /** GET /auth/sessions */
    getSessions: build.query<SessionsResponse, void>({
      query: () => '/auth/sessions',
      providesTags: ['Session'],
    }),

    /** DELETE /auth/sessions/:sessionId */
    deleteSession: build.mutation<MessageResponse, string>({
      query: (sessionId) => ({
        url: `/auth/sessions/${sessionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Session'],
    }),

    /** POST /invitations/:token/accept */
    acceptInvitation: build.mutation<InvitationAcceptResponse, string>({
      query: (token) => ({
        url: `/invitations/${token}/accept`,
        method: 'POST',
      }),
      invalidatesTags: ['Organization'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMeQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useRefreshMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetSessionsQuery,
  useDeleteSessionMutation,
  useAcceptInvitationMutation,
} = authApi;
