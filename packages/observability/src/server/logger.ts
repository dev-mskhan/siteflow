import pino, { type Logger, type LoggerOptions } from 'pino';
import { trace, context, SpanStatusCode, type Span } from '@opentelemetry/api';

export { SpanStatusCode };
export type { Span, Logger };

/**
 * Creates a pino logger that injects OTEL trace/span IDs into every log line.
 * This links your logs → traces in SigNoz.
 */
export function createLogger(options: LoggerOptions & { name: string }): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    ...options,
    redact: {
      paths: [
        'password',
        'passwordHash',
        'currentPassword',
        'newPassword',
        'token',
        'refreshToken',
        'accessToken',
        'authorization',
        'cookie',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.refreshToken',
        '*.accessToken',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    mixin() {
      const span = trace.getActiveSpan();
      if (!span) return {};
      const { traceId, spanId, traceFlags } = span.spanContext();
      return {
        trace_id: traceId,
        span_id: spanId,
        trace_flags: `0${traceFlags.toString(16)}`,
      };
    },
  });
}

/**
 * Wraps a function in an OTEL span, recording errors automatically.
 */
export async function withSpan<T>(
  tracer: ReturnType<typeof trace.getTracer>,
  name: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

export { trace, context };
