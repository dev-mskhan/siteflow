// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Type-safe object keys
 */
export function keys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

/**
 * Sleep helper for retries / tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert value is non-null / non-undefined
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): T {
  if (value == null) {
    throw new Error(message ?? 'Expected value to be defined');
  }
  return value;
}

/**
 * Create a success API response
 */
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true as const, data, meta };
}

/**
 * Create an error API response
 */
export function err(code: string, message: string, details?: unknown) {
  return { success: false as const, error: { code, message, details } };
}
