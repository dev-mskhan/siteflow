/**
 * authErrors.ts — helpers for extracting structured error messages
 * from RTK Query error objects.
 *
 * Error routing rules (from the plan):
 *   INLINE  — 401 on login, 409 conflict, 422 validation, 400 bad token
 *   TOAST   — 429 rate limit, 403 suspended, 500 server error, network error
 */

import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';

export interface ServerError {
  code: string;
  message: string;
  details?: unknown;
}

/** Extracts the server { code, message } from an RTK Query error, if present */
export function getServerError(
  error: FetchBaseQueryError | SerializedError | undefined,
): ServerError | null {
  if (!error) return null;

  if ('status' in error && error.data && typeof error.data === 'object') {
    const data = error.data as { error?: ServerError };
    if (data.error) return data.error;
  }

  if ('message' in error && error.message) {
    return { code: 'UNKNOWN', message: error.message };
  }

  return { code: 'UNKNOWN', message: 'An unexpected error occurred. Please try again.' };
}

/** True when the error should be shown inline (not as a toast) */
export function isInlineError(error: FetchBaseQueryError | SerializedError | undefined): boolean {
  if (!error) return false;
  if (!('status' in error)) return false;

  const status = error.status;
  return status === 401 || status === 409 || status === 422 || status === 400;
}

/** True when the error should be shown as a toast */
export function isToastError(error: FetchBaseQueryError | SerializedError | undefined): boolean {
  if (!error) return false;
  if (!('status' in error)) return true; // network/serialized errors → toast

  const { status } = error;
  return (
    status === 429 ||
    status === 403 ||
    status === 404 ||
    status === 500 ||
    status === 'FETCH_ERROR' ||
    status === 'PARSING_ERROR'
  );
}

/** Human-readable message for toast errors */
export function toastErrorMessage(error: FetchBaseQueryError | SerializedError | undefined): string {
  if (!error) return 'An unexpected error occurred.';

  if ('status' in error) {
    const { status } = error;
    const server = getServerError(error);

    if (status === 429 || server?.code === 'TOO_MANY_REQUESTS') {
      return 'Too many attempts. Please try again in 15 minutes.';
    }
    if (status === 403 || server?.code === 'FORBIDDEN') {
      return 'Your account has been suspended. Contact support.';
    }
    if (status === 'FETCH_ERROR') {
      return 'Cannot reach the server. Check your connection.';
    }
    if (server?.message) {
      return server.message;
    }
  }

  if ('message' in error && error.message) return error.message;

  return 'Something went wrong. Please try again.';
}
