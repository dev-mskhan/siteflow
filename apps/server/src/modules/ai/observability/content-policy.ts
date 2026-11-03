import { serverEnv } from '../../../config/env.js';

const SENSITIVE_KEY =
  /password|secret|token|api[_-]?key|authorization|cookie|email|phone|ssn|date[_-]?of[_-]?birth|address/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[A-Z0-9._~+/-]+=*/gi;
const PHONE = /\b(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const MAX_STRING_LENGTH = 20_000;
const MAX_CONTENT_LENGTH = 100_000;
const MAX_CONTENT_NODES = 10_000;
const MAX_CONTENT_DEPTH = 20;

export type LangfuseContentMode = 'metadata-only' | 'redacted' | 'full';

export function getLangfuseContentMode(): LangfuseContentMode {
  return serverEnv.LANGFUSE_CAPTURE_CONTENT;
}

export function sanitizeLangfuseContent(value: unknown): unknown {
  const mode = getLangfuseContentMode();
  if (mode === 'metadata-only') return undefined;
  return cloneValue(
    value,
    mode === 'redacted',
    { remaining: MAX_CONTENT_LENGTH, nodes: MAX_CONTENT_NODES },
    new WeakSet(),
  );
}

export function sanitizeLangfuseMetadata(value: unknown): unknown {
  return cloneValue(
    value,
    getLangfuseContentMode() !== 'full',
    { remaining: 10_000, nodes: 1_000 },
    new WeakSet(),
  );
}

export function sanitizeLangfuseText(value: string): string | undefined {
  const sanitized = sanitizeLangfuseContent(value);
  return typeof sanitized === 'string' ? sanitized : undefined;
}

function cloneValue(
  value: unknown,
  redact: boolean,
  budget: { remaining: number; nodes: number },
  seen: WeakSet<object>,
  key?: string,
  depth = 0,
): unknown {
  if (redact && key && SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (depth >= MAX_CONTENT_DEPTH || budget.remaining <= 0 || budget.nodes <= 0) {
    return '[TRUNCATED]';
  }
  budget.nodes -= 1;
  if (typeof value === 'string') {
    const length = Math.min(value.length, MAX_STRING_LENGTH, budget.remaining);
    budget.remaining -= length;
    const content = value.slice(0, length);
    if (!redact) return content;
    return content
      .replace(EMAIL, '[REDACTED_EMAIL]')
      .replace(BEARER, 'Bearer [REDACTED]')
      .replace(PHONE, '[REDACTED_PHONE]');
  }
  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (const item of value) {
        if (budget.nodes <= 0 || budget.remaining <= 0) {
          result.push('[TRUNCATED]');
          break;
        }
        result.push(cloneValue(item, redact, budget, seen, undefined, depth + 1));
      }
      return result;
    }
    const result: Record<string, unknown> = {};
    for (const entryKey in value) {
      if (!Object.hasOwn(value, entryKey)) continue;
      if (budget.nodes <= 0 || budget.remaining <= 0) {
        result['[TRUNCATED]'] = true;
        break;
      }
      budget.remaining -= entryKey.length;
      result[entryKey] = cloneValue(
        (value as Record<string, unknown>)[entryKey],
        redact,
        budget,
        seen,
        entryKey,
        depth + 1,
      );
    }
    return result;
  }
  return value;
}
