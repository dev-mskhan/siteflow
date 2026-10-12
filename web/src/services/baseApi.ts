import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Base RTK Query API slice for SiteFlow.
 * Configured with `/api/v1` base URL and standard tag types.
 * Endpoints initially use `queryFn` with mock data and realistic delay.
 * Later backend integration only requires updating this file and feature `api.ts` files.
 */
export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    prepareHeaders: (headers) => {
      // Prepared for bearer tokens from auth storage
      const token = typeof window !== 'undefined' ? localStorage.getItem('siteflow_auth_token') : null;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    'Auth',
    'Organization',
    'Project',
    'Estimate',
    'BOQ',
    'Task',
    'Schedule',
    'Procurement',
    'Finance',
    'PaymentApplication',
    'User',
  ],
  endpoints: () => ({}),
});
