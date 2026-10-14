import { baseApi } from '../../services/baseApi';
import type { UserDTO, SessionDTO } from '@siteflow/shared';

// ─── Response shape helpers ───────────────────────────────────────────────────

interface AuthUserResponse {
  user: UserDTO;
}

interface MessageResponse {
  message: string;
}

interface SessionsResponse {
  sessions: SessionDTO[];
  nextCursor: string | null;
}

interface GoogleUrlResponse {
  url: string;
  state: string;
}

interface LogoutAllResponse {
  message: string;
}

// ─── Auth API endpoints injected into the base slice ─────────────────────────

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Public mutations ────────────────────────────────────────────────────

    register: build.mutation<AuthUserResponse, {
      email: string;
      password: string;
      firstName: string;
      lastName?: string;
    }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      // RTK Query wraps the response — unwrap the envelope in transformResponse
      transformResponse: (raw: { data: AuthUserResponse }) => raw.data,
      invalidatesTags: ['User'],
    }),

    login: build.mutation<AuthUserResponse, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (raw: { data: AuthUserResponse }) => raw.data,
      invalidatesTags: ['User'],
    }),

    logout: build.mutation<MessageResponse, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      transformResponse: (raw: { data: MessageResponse }) => raw.data,
      // Invalidate everything on logout
      invalidatesTags: ['User', 'Session', 'Organization'],
    }),

    logoutAll: build.mutation<LogoutAllResponse, void>({
      query: () => ({ url: '/auth/logout-all', method: 'POST' }),
      transformResponse: (raw: { data: LogoutAllResponse }) => raw.data,
      invalidatesTags: ['User', 'Session'],
    }),

    verifyEmail: build.mutation<MessageResponse, { token: string }>({
      query: (body) => ({ url: '/auth/verify-email', method: 'POST', body }),
      transformResponse: (raw: { data: MessageResponse }) => raw.data,
      invalidatesTags: ['User'],
    }),

    resendVerification: build.mutation<MessageResponse, { email: string }>({
      query: (body) => ({ url: '/auth/resend-verification', method: 'POST', body }),
      transformResponse: (raw: { data: MessageResponse }) => raw.data,
    }),

    forgotPassword: build.mutation<MessageResponse, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
      transformResponse: (raw: { data: MessageResponse }) => raw.data,
    }),

    resetPassword: build.mutation<MessageResponse, { token: string; newPassword: string }>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
      transformResponse: (raw: { data: MessageResponse }) => raw.data,
    }),

    changePassword: build.mutation<MessageResponse, {
      currentPassword: string;
      newPassword: string;
    }>({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
      transformResponse: (raw: { data: MessageResponse }) => raw.data,
      invalidatesTags: ['Session'],
    }),

    // ── Protected queries ───────────────────────────────────────────────────

    getMe: build.query<AuthUserResponse, void>({
      query: () => '/auth/me',
      transformResponse: (raw: { data: AuthUserResponse }) => raw.data,
      providesTags: ['User'],
    }),

    getSessions: build.query<SessionsResponse, void>({
      query: () => '/auth/sessions',
      transformResponse: (raw: { data: SessionsResponse }) => raw.data,
      providesTags: ['Session'],
    }),

    deleteSession: build.mutation<MessageResponse, string>({
      query: (sessionId) => ({ url: `/auth/sessions/${sessionId}`, method: 'DELETE' }),
      transformResponse: (raw: { data: MessageResponse }) => raw.data,
      invalidatesTags: ['Session'],
    }),

    // ── Google OAuth ────────────────────────────────────────────────────────

    getGoogleAuthUrl: build.query<GoogleUrlResponse, void>({
      query: () => '/auth/google',
      transformResponse: (raw: { data: GoogleUrlResponse }) => raw.data,
    }),

  }),
  overrideExisting: true,
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useGetSessionsQuery,
  useDeleteSessionMutation,
  useLazyGetGoogleAuthUrlQuery,
} = authApi;
