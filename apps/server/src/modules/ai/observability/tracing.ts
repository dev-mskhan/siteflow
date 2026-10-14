// apps/server/src/modules/ai/observability/tracing.ts
//
// Wires Langfuse (LLM-level tracing) into every LangChain invocation via a
// callback handler, and correlates Langfuse trace IDs with the existing OTel
// trace context so both systems show the same run.
//
// Design:
//   - If LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are absent, tracing is a no-op.
//     Never throw at startup — optional feature, never a hard dependency.
//   - getTraceCallback(runId, ctx) returns a LangChain BaseCallbackHandler.
//     Pass it alongside the UsageAccumulator callback in model-factory.ts.
//   - extractTraceId(handler) returns the Langfuse trace ID after the run ends.
//     The runner stores this in agent_runs.trace_id.

import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '@siteflow/observability/server';
import { serverEnv } from '../../../config/env.js';
import type { RunContext } from '../core/run-context.js';

const logger = createLogger({ name: 'ai-tracing' });

export interface AiTraceHandle {
  /** LangChain callback to pass into model.invoke() / graph.stream() */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: any;
  /** Resolves to the Langfuse trace ID after the run completes — may be undefined */
  getTraceId: () => string | undefined;
}

/**
 * Returns a tracing handle for a run.
 * If Langfuse env vars are absent the callback is a harmless no-op object.
 */
export function buildTraceHandle(ctx: RunContext): AiTraceHandle {
  const { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST } = serverEnv;

  // ── No-op path ────────────────────────────────────────────────────────────
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    return {
      callback: null,
      getTraceId: () => undefined,
    };
  }

  // ── Langfuse path ─────────────────────────────────────────────────────────
  // Dynamic import so the module doesn't hard-fail if the package isn't installed.
  let traceId: string | undefined;

  const callbackPromise: Promise<unknown> = (async () => {
    try {
      // langfuse-langchain is the official LangChain integration package
      const { CallbackHandler } = await import('langfuse-langchain');

      const handler = new CallbackHandler({
        publicKey:  LANGFUSE_PUBLIC_KEY,
        secretKey:  LANGFUSE_SECRET_KEY,
        baseUrl:    LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
        // Use runId as the Langfuse trace ID so every run is one trace
        sessionId:     ctx.runId,
        userId:        ctx.userId,
        // Correlate with OTel active span
        metadata: {
          organizationId: ctx.organizationId,
          projectId:      ctx.projectId ?? null,
          agent:          ctx.agent,
          otelTraceId:    trace.getActiveSpan()?.spanContext().traceId,
        },
      });

      // Capture the traceId when the first LLM call finishes
      const originalHandleLLMEnd = handler.handleLLMEnd?.bind(handler);
      if (originalHandleLLMEnd) {
        handler.handleLLMEnd = async (...args: Parameters<typeof originalHandleLLMEnd>) => {
          try {
            // Langfuse JS SDK exposes traceId on the handler after first flush
            traceId = (handler as any).traceId ?? ctx.runId;
          } catch { /* ignore */ }
          return originalHandleLLMEnd(...args);
        };
      }

      return handler;
    } catch (err) {
      logger.warn({ err }, 'Langfuse callback handler unavailable — tracing disabled');
      return null;
    }
  })();

  // Expose a synchronous getter backed by the async init
  // (traceId is set during handleLLMEnd which fires before getTraceId is called)
  return {
    callback: callbackPromise, // runner spreads this into the callbacks array
    getTraceId: () => traceId ?? ctx.runId,
  };
}
