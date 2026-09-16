// ─── App-wide constants ───────────────────────────────────────────────────────

export const APP_NAME = 'SiteFlow';
export const APP_VERSION = '0.0.1';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const CACHE_TTL = {
  SHORT: 60,       // 1 minute
  MEDIUM: 300,     // 5 minutes
  LONG: 3600,      // 1 hour
  DAY: 86400,      // 24 hours
} as const;

export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
