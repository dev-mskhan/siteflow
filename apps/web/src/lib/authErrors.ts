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

const SAFE_UNEXPECTED_ERROR = 'Something went wrong. Please try again.';

function isServerFailureStatus(status: FetchBaseQueryError['status']): boolean {
  return typeof status === 'number' ? status >= 500 : /^\d+$/.test(status) && Number(status) >= 500;
}

export function getFieldValidationErrors(
  error: FetchBaseQueryError | SerializedError | undefined,
): Record<string, string> {
  const serverError = getServerError(error);
  if (!serverError || !error || !('status' in error) || ![400, 422].includes(Number(error.status))) {
    return {};
  }

  const details = serverError.details;
  const candidates = Array.isArray(details)
    ? details
    : (() => {
        if (typeof serverError.message !== 'string') return [];
        try {
          const parsed: unknown = JSON.parse(serverError.message);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

  return candidates.reduce<Record<string, string>>((result, candidate) => {
    if (!candidate || typeof candidate !== 'object') return result;
    const item = candidate as { path?: unknown; message?: unknown };
    const path = Array.isArray(item.path) ? item.path.join('.') : '';
    if (path && typeof item.message === 'string') result[path] = item.message;
    return result;
  }, {});
}

/** Extracts the server { code, message } from an RTK Query error, if present */
export function getServerError(
  error: FetchBaseQueryError | SerializedError | undefined,
): ServerError | null {
  if (!error) return null;

  if ('status' in error && isServerFailureStatus(error.status)) {
    return { code: 'INTERNAL_SERVER_ERROR', message: SAFE_UNEXPECTED_ERROR };
  }

  if ('status' in error && error.data && typeof error.data === 'object') {
    const data = error.data as { error?: ServerError };
    if (data.error) return data.error;
  }

  return { code: 'UNKNOWN', message: SAFE_UNEXPECTED_ERROR };
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
    isServerFailureStatus(status) ||
    status === 'FETCH_ERROR' ||
    status === 'PARSING_ERROR' ||
    status === 'TIMEOUT_ERROR'
  );
}

/** Human-readable message for toast errors */
export function toastErrorMessage(error: FetchBaseQueryError | SerializedError | undefined): string {
  if (!error) return SAFE_UNEXPECTED_ERROR;

  if ('status' in error) {
    const { status } = error;

    if (status === 429) {
      return 'Too many attempts. Please try again in 15 minutes.';
    }
    if (status === 403) {
      return "You don't have permission to perform this action.";
    }
    if (status === 404) {
      return 'The requested item could not be found.';
    }
    if (status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
      return 'Cannot reach the server. Check your connection.';
    }
    if (isServerFailureStatus(status) || status === 'PARSING_ERROR' || status === 'CUSTOM_ERROR') {
      return SAFE_UNEXPECTED_ERROR;
    }

    return getServerError(error)?.message ?? SAFE_UNEXPECTED_ERROR;
  }

  return SAFE_UNEXPECTED_ERROR;
}
