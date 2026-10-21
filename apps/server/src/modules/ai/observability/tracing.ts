// apps/server/src/modules/ai/observability/tracing.ts
// Langfuse LLM-level tracing and correlation integration.

import { trace } from '@opentelemetry/api';
import { createLogger } from '@siteflow/observability/server';
import { getLangfuseClient } from './langfuse-client.js';
import type { RunContext } from '../core/run-context.js';

const logger = createLogger({ name: 'ai-tracing' });

export interface GenerationHandle {
  end(output: unknown, usage?: { inputTokens: number; outputTokens: number }): void;
}

export interface RunTraceHandle {
  traceId: string;
  startGeneration(name: string, input: unknown): GenerationHandle;
  end(output: unknown, level?: 'DEFAULT' | 'WARNING' | 'ERROR'): void;
  getTraceId(): string | undefined;
}

/**
 * Builds a trace handle for a given RunContext.
 * If Langfuse is not configured, returns a lightweight no-op implementation.
 */
export function buildTraceHandle(ctx: RunContext): RunTraceHandle {
  const lf = getLangfuseClient();
  const traceId = ctx.correlationId ?? ctx.runId;

  if (!lf) {
    return {
      traceId,
      startGeneration: (_name, _input) => ({ end: () => {} }),
      end: () => {},
      getTraceId: () => undefined,
    };
  }

  try {
    const activeSpan = trace.getActiveSpan();
    const otelTraceId = activeSpan?.spanContext().traceId;

    const langfuseTrace = lf.trace({
      id: traceId,
      name: `agent:${ctx.agent}`,
      userId: ctx.userId,
      sessionId: ctx.runId,
      metadata: {
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        projectId: ctx.projectId ?? null,
        provider: ctx.provider ?? null,
        model: ctx.model ?? null,
        otelTraceId: otelTraceId ?? null,
      },
    });

    return {
      traceId,
      startGeneration: (name: string, input: unknown) => {
        try {
          const gen = langfuseTrace.generation({
            name,
            input,
            model: ctx.model ?? undefined,
          });
          return {
            end: (output: unknown, usage?: { inputTokens: number; outputTokens: number }) => {
              try {
                gen.end({
                  output,
                  usage: usage
                    ? {
                        input: usage.inputTokens,
                        output: usage.outputTokens,
                        total: usage.inputTokens + usage.outputTokens,
                      }
                    : undefined,
                });
              } catch (err) {
                logger.warn({ err }, 'Failed to record generation end in Langfuse');
              }
            },
          };
        } catch (err) {
          logger.warn({ err }, 'Failed to start generation in Langfuse');
          return { end: () => {} };
        }
      },
      end: (output: unknown, level: 'DEFAULT' | 'WARNING' | 'ERROR' = 'DEFAULT') => {
        try {
          langfuseTrace.update({
            output,
            metadata: { level },
          });
        } catch (err) {
          logger.warn({ err }, 'Failed to end Langfuse trace');
        }
      },
      getTraceId: () => traceId,
    };
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Langfuse trace handle');
    return {
      traceId,
      startGeneration: (_name, _input) => ({ end: () => {} }),
      end: () => {},
      getTraceId: () => undefined,
    };
  }
}
