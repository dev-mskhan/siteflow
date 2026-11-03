// apps/server/src/modules/ai/observability/tracing.ts
// Langfuse LLM-level tracing and correlation integration.

import { trace } from '@opentelemetry/api';
import { createLogger } from '@siteflow/observability/server';
import { getLangfuseClient } from './langfuse-client.js';
import type { RunContext } from '../core/run-context.js';
import { getAgent } from '../core/agent-registry.js';
import { serverEnv } from '../../../config/env.js';
import {
  sanitizeLangfuseContent,
  sanitizeLangfuseMetadata,
  sanitizeLangfuseText,
} from './content-policy.js';

const logger = createLogger({ name: 'ai-tracing' });

export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: string;
  outputCostUsd: string;
  totalCostUsd: string;
  costSource: 'model-price-table' | 'configured-zero-cost-local-proxy';
  usageSource: 'provider-reported' | 'estimated';
}

export interface GenerationHandle {
  end(output: unknown, usage?: GenerationUsage, error?: string): void;
}

export interface ObservationHandle {
  end(
    output: unknown,
    level?: 'DEFAULT' | 'WARNING' | 'ERROR',
    statusMessage?: string,
  ): void;
}

export interface RunTraceHandle {
  traceId: string;
  startGeneration(name: string, input: unknown): GenerationHandle;
  startSpan(name: string, input: unknown, metadata?: Record<string, unknown>): ObservationHandle;
  score(
    name: string,
    value: number,
    comment: string,
    metadata?: Record<string, unknown>,
  ): void;
  end(
    output: unknown,
    level?: 'DEFAULT' | 'WARNING' | 'ERROR',
    status?: 'SUCCEEDED' | 'FAILED' | 'AWAITING_APPROVAL',
  ): void;
  getTraceId(): string | undefined;
}

export function recordTraceScore(
  traceId: string,
  name: string,
  value: number,
  comment: string,
  metadata?: Record<string, unknown>,
): void {
  const lf = getLangfuseClient();
  if (!lf) return;
  try {
    lf.trace({ id: traceId }).score({
      name,
      value,
      dataType: 'NUMERIC',
      comment: sanitizeLangfuseText(comment),
      metadata: sanitizeLangfuseMetadata(metadata),
    });
  } catch (err) {
    logger.warn({ err, traceId, scoreName: name }, 'Failed to record score in Langfuse');
  }
}

function noOpTraceHandle(traceId: string): RunTraceHandle {
  return {
    traceId,
    startGeneration: () => ({ end: () => {} }),
    startSpan: () => ({ end: () => {} }),
    score: () => {},
    end: () => {},
    getTraceId: () => undefined,
  };
}

/**
 * Builds a trace handle for a given RunContext.
 * If Langfuse is not configured, returns a lightweight no-op implementation.
 */
export function buildTraceHandle(ctx: RunContext, input: unknown = ctx.input ?? {}): RunTraceHandle {
  const lf = getLangfuseClient();
  const traceId = ctx.runId;

  if (!lf) return noOpTraceHandle(traceId);

  try {
    const activeSpan = trace.getActiveSpan();
    const otelTraceId = activeSpan?.spanContext().traceId;
    const conversationId =
      typeof ctx.input?.conversationId === 'string' ? ctx.input.conversationId : undefined;
    const manifest = getAgent(ctx.agent);
    const agentVersion = manifest?.version;
    const promptVersion = manifest?.promptVersion;
    const traceMetadata = {
      runId: ctx.runId,
      organizationId: ctx.organizationId,
      projectId: ctx.projectId ?? null,
      provider: ctx.provider ?? null,
      model: ctx.model ?? null,
      agentVersion: agentVersion ?? null,
      promptVersion: promptVersion ?? null,
      correlationId: ctx.correlationId ?? null,
      otelTraceId: otelTraceId ?? null,
      contentMode: serverEnv.LANGFUSE_CAPTURE_CONTENT,
    };

    const langfuseTrace = lf.trace({
      id: traceId,
      name: `agent:${ctx.agent}`,
      input: sanitizeLangfuseContent(input),
      userId: ctx.userId,
      sessionId: conversationId ?? ctx.runId,
      environment: serverEnv.NODE_ENV,
      version: agentVersion,
      tags: [`agent:${ctx.agent}`],
      metadata: traceMetadata,
    });

    return {
      traceId,
      startGeneration: (name: string, input: unknown) => {
        try {
          const gen = langfuseTrace.generation({
            name,
            input: sanitizeLangfuseContent(input),
            model: ctx.model ?? undefined,
            metadata: {
              agentVersion: agentVersion ?? null,
              promptVersion: promptVersion ?? null,
            },
            startTime: new Date(),
            environment: serverEnv.NODE_ENV,
          });
          return {
            end: (output: unknown, usage?: GenerationUsage, error?: string) => {
              try {
                gen.end({
                  output: sanitizeLangfuseContent(output),
                  usage: usage
                    ? {
                        input: usage.inputTokens,
                        output: usage.outputTokens,
                        total: usage.inputTokens + usage.outputTokens,
                      }
                    : undefined,
                  usageDetails: usage
                    ? {
                        input: usage.inputTokens,
                        output: usage.outputTokens,
                        total: usage.inputTokens + usage.outputTokens,
                      }
                    : undefined,
                  costDetails: usage
                    ? {
                        input: Number(usage.inputCostUsd),
                        output: Number(usage.outputCostUsd),
                        total: Number(usage.totalCostUsd),
                      }
                    : undefined,
                  metadata: usage
                    ? { usageSource: usage.usageSource, costSource: usage.costSource }
                    : undefined,
                  level: error ? 'ERROR' : 'DEFAULT',
                  statusMessage: error,
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
      startSpan: (name: string, input: unknown, metadata?: Record<string, unknown>) => {
        try {
          const span = langfuseTrace.span({
            name,
            input: sanitizeLangfuseContent(input),
            metadata: sanitizeLangfuseMetadata(metadata),
            startTime: new Date(),
            environment: serverEnv.NODE_ENV,
          });
          return {
            end: (
              output: unknown,
              level: 'DEFAULT' | 'WARNING' | 'ERROR' = 'DEFAULT',
              statusMessage?: string,
            ) => {
              try {
                span.end({
                  output: sanitizeLangfuseContent(output),
                  level,
                  statusMessage,
                });
              } catch (err) {
                logger.warn({ err, observation: name }, 'Failed to record span end in Langfuse');
              }
            },
          };
        } catch (err) {
          logger.warn({ err, observation: name }, 'Failed to start span in Langfuse');
          return { end: () => {} };
        }
      },
      score: (name, value, comment, metadata) => {
        try {
          langfuseTrace.score({
            name,
            value,
            dataType: 'NUMERIC',
            comment: sanitizeLangfuseText(comment),
            metadata: sanitizeLangfuseMetadata(metadata),
          });
        } catch (err) {
          logger.warn({ err, scoreName: name }, 'Failed to record score in Langfuse');
        }
      },
      end: (
        output: unknown,
        level: 'DEFAULT' | 'WARNING' | 'ERROR' = 'DEFAULT',
        status: 'SUCCEEDED' | 'FAILED' | 'AWAITING_APPROVAL' =
          level === 'ERROR' ? 'FAILED' : 'SUCCEEDED',
      ) => {
        try {
          const traceOutput =
            output instanceof Error
              ? { name: output.name, message: output.message }
              : output;
          langfuseTrace.update({
            output: sanitizeLangfuseContent(traceOutput),
            metadata: {
              ...traceMetadata,
              status,
            },
          });
        } catch (err) {
          logger.warn({ err }, 'Failed to end Langfuse trace');
        }
      },
      getTraceId: () => traceId,
    };
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Langfuse trace handle');
    return noOpTraceHandle(traceId);
  }
}
