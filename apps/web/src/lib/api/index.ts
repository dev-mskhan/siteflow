/**
 * SiteFlow Canonical API Client
 * Interacts with Fastify Backend (/api/v1) following the standard API response envelope:
 * Success: { success: true, data: T, meta?: Record<string, unknown> }
 * Error:   { success: false, error: { code: string, message: string, details?: unknown, requestId?: string } }
 */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp?: string;
    requestId?: string;
    [key: string]: unknown;
  };
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: unknown;
  public requestId?: string;

  constructor(message: string, code: string = 'API_ERROR', status: number = 500, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export class NetworkError extends ApiError {
  constructor(message: string = 'Network error: please check your internet connection') {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Session expired or unauthenticated. Please log in again.') {
    super(message, 'UNAUTHENTICATED', 401);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuthRefresh?: boolean;
}

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '/api/v1';

class HttpClient {
  private baseUrl: string;
  private onUnauthorizedCallback?: () => void;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  public setOnUnauthorized(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      });
    }
    return url.toString();
  }

  public async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { body, params, headers, skipAuthRefresh, ...customConfig } = options;

    const url = this.buildUrl(endpoint, params);

    const defaultHeaders: HeadersInit = {
      'Accept': 'application/json',
    };

    if (body !== undefined && !(body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
      credentials: 'include', // essential for httpOnly access_token & refresh_token cookies
      headers: {
        ...defaultHeaders,
        ...headers,
      },
      ...customConfig,
    };

    if (body !== undefined) {
      config.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (err: unknown) {
      throw new NetworkError(err instanceof Error ? err.message : undefined);
    }

    let payload: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      if (response.status === 401) {
        if (!skipAuthRefresh && this.onUnauthorizedCallback) {
          this.onUnauthorizedCallback();
        }
        const errorDetail = (payload as ApiErrorResponse)?.error;
        throw new AuthenticationError(errorDetail?.message || 'Unauthorized');
      }

      if (typeof payload === 'object' && payload !== null && 'error' in payload) {
        const errorPayload = payload as ApiErrorResponse;
        if (response.status === 400 && errorPayload.error.code === 'VALIDATION_ERROR') {
          throw new ValidationError(errorPayload.error.message, errorPayload.error.details);
        }
        throw new ApiError(
          errorPayload.error.message || 'An error occurred',
          errorPayload.error.code || 'HTTP_ERROR',
          response.status,
          errorPayload.error.details,
          errorPayload.error.requestId
        );
      }

      throw new ApiError(
        typeof payload === 'string' && payload ? payload : response.statusText || 'Request failed',
        `HTTP_${response.status}`,
        response.status
      );
    }

    if (typeof payload === 'object' && payload !== null && 'success' in payload) {
      const standardPayload = payload as ApiSuccessResponse<T>;
      return standardPayload.data;
    }

    return payload as T;
  }

  public get<T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  public patch<T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  public put<T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  public delete<T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new HttpClient();
