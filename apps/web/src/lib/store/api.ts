/**
 * RTK Query base API
 * All feature API slices inject into this base.
 * Handles: credentials:include, response envelope unwrapping,
 *          automatic 401 logout via onQueryStarted/middleware
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

/** Standard Fastify response envelope */
interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

const API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '/api/v1';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers) => {
    headers.set('Accept', 'application/json');
    return headers;
  },
});

/**
 * Unwraps the `{ success: true, data: T }` envelope and surfaces
 * `{ success: false, error }` as a proper RTK Query error object.
 * Also handles 401 — dispatched as a special tag invalidation.
 */
const baseQueryWithEnvelopeUnwrap: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) {
    return result;
  }

  const data = result.data as ApiSuccessEnvelope<unknown> | ApiErrorEnvelope | unknown;

  if (
    data !== null &&
    typeof data === 'object' &&
    'success' in (data as object)
  ) {
    const envelope = data as ApiSuccessEnvelope<unknown> | ApiErrorEnvelope;

    if (envelope.success === false) {
      return {
        error: {
          status: 'CUSTOM_ERROR',
          error: envelope.error.message,
          data: envelope.error,
        } as FetchBaseQueryError,
      };
    }

    // Unwrap data from envelope
    return { data: (envelope as ApiSuccessEnvelope<unknown>).data };
  }

  return result;
};

export const siteflowApi = createApi({
  reducerPath: 'siteflowApi',
  baseQuery: baseQueryWithEnvelopeUnwrap,
  keepUnusedDataFor: 60,
  tagTypes: [
    'Auth',
    'Session',
    'Organization',
    'Project',
    'Billing',
    'Trial',
    'Invitation',
  ],
  endpoints: () => ({}),
});
