import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { RootState } from '../app/store';

// ─── Envelope types shared across all modules ─────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { timestamp?: string; [key: string]: unknown };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Raw base query (cookies, no retry logic) ─────────────────────────────────

const rawBaseQuery = fetchBaseQuery({
  baseUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1',
  // Server uses HttpOnly signed cookies for access_token + refresh_token.
  // credentials: 'include' is REQUIRED — the browser won't send cookies otherwise.
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    // Fallback Bearer header for environments where cookies are blocked (e.g. native app)
    const token = (getState() as RootState).auth?.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// ─── Wrapped base query with silent 401 → refresh → retry ────────────────────
// Fires POST /auth/refresh (reads refresh_token cookie automatically).
// On success the server sets a new access_token cookie and we retry.
// On failure we dispatch authSessionExpired so the UI can redirect.

let isRefreshing = false;

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra);

  if (result.error?.status === 401) {
    // Prevent concurrent refresh calls from racing
    if (!isRefreshing) {
      isRefreshing = true;

      const refreshResult = await rawBaseQuery(
        { url: '/auth/refresh', method: 'POST' },
        api,
        extra,
      );

      isRefreshing = false;

      if (refreshResult.data) {
        // New cookies set by server — retry the original request
        result = await rawBaseQuery(args, api, extra);
      } else {
        // Refresh itself failed — session truly expired
        const { authSessionExpired } = await import('../features/auth/authSlice');
        api.dispatch(authSessionExpired());
      }
    }
  }

  return result;
};

// ─── Base API slice ────────────────────────────────────────────────────────────

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'User',
    'Session',
    'Organization',
    'OrgProfile',
    'OrgSettings',
    'DocSequence',
    'Member',
    'Invitation',
    'AuditLog',
    'Project',
    'CostCode',
    'FieldLog',
    'PurchaseOrder',
    'MaterialRequest',
    'Supplier',
    'Material',
    'Report',
    'Billing',
  ],
  endpoints: () => ({}),
});
