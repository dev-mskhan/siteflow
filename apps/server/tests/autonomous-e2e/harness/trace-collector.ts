// apps/server/tests/autonomous-e2e/harness/trace-collector.ts
// Queries Langfuse API for completed traces and extracts:
// - Tool calls (name, args, result, status)
// - Token usage (input, output, total)
// - Latency (LLM, tool execution, end-to-end)
// - Errors and retries
// Used for assertions + metrics collection

import { config } from '@siteflow/env/server';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'trace-collector' });

export interface ToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  durationMs: number;
}

export interface TraceData {
  traceId: string;
  runId: string;
  organizationId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  durationMs: number;
  toolCalls: ToolCallTrace[];
  observations: Array<{
    type: string;
    name: string;
    input?: unknown;
    output?: unknown;
    level?: string;
    statusMessage?: string;
  }>;
}

export class TraceCollector {
  private readonly baseUrl: string;
  private readonly publicKey: string;
  private readonly secretKey: string;

  constructor() {
    this.baseUrl = config.LANGFUSE_HOST || 'http://localhost:3020';
    this.publicKey = config.LANGFUSE_PUBLIC_KEY || '';
    this.secretKey = config.LANGFUSE_SECRET_KEY || '';
  }

  /**
   * Fetch a trace by ID from Langfuse API
   * Retries with exponential backoff if trace not ready yet
   */
  async getTrace(traceId: string, maxAttempts = 5): Promise<TraceData> {
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const response = await fetch(`${this.baseUrl}/api/public/traces/${traceId}`, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64')}`,
          },
        });

        if (response.status === 404 && attempt < maxAttempts) {
          // Trace not ready yet, retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Langfuse API error ${response.status}: ${error}`);
        }

        const data = await response.json();
        return this.parseTrace(data);
      } catch (err) {
        if (attempt >= maxAttempts) {
          logger.error({ err, traceId }, 'Failed to fetch trace after retries');
          throw err;
        }
        logger.warn({ err, traceId, attempt }, 'Trace fetch failed, retrying');
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error(`Failed to fetch trace ${traceId} after ${maxAttempts} attempts`);
  }

  /**
   * Parse raw Langfuse trace data into structured format
   */
  private parseTrace(raw: any): TraceData {
    const observations = raw.observations || [];
    
    // Extract tool calls (spans with name starting with "tool:")
    const toolCalls: ToolCallTrace[] = observations
      .filter((obs: any) => obs.type === 'span' && obs.name?.startsWith('tool:'))
      .map((obs: any) => ({
        name: obs.name.replace('tool:', ''),
        args: obs.input || {},
        result: obs.output,
        status: obs.level === 'ERROR' ? 'ERROR' : 'SUCCESS',
        errorMessage: obs.statusMessage,
        durationMs: obs.endTime ? new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime() : 0,
      }));

    // Calculate token usage
    const generations = observations.filter((obs: any) => obs.type === 'generation');
    const inputTokens = generations.reduce((sum: number, gen: any) => sum + (gen.usage?.promptTokens || 0), 0);
    const outputTokens = generations.reduce((sum: number, gen: any) => sum + (gen.usage?.completionTokens || 0), 0);
    const totalCost = generations.reduce((sum: number, gen: any) => sum + (gen.usage?.totalCost || 0), 0);

    // Calculate total duration
    const startTime = raw.timestamp ? new Date(raw.timestamp).getTime() : 0;
    const endTime = observations.length > 0 && observations[0].endTime 
      ? new Date(observations[0].endTime).getTime() 
      : startTime;

    return {
      traceId: raw.id,
      runId: raw.metadata?.runId || '',
      organizationId: raw.metadata?.organizationId || '',
      userId: raw.userId || '',
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      totalCost,
      durationMs: endTime - startTime,
      toolCalls,
      observations,
    };
  }

  /**
   * Check if trace contains specific data (for leak detection)
   */
  containsData(trace: TraceData, searchValue: string): boolean {
    const allContent = [
      JSON.stringify(trace.observations),
      ...trace.toolCalls.map(tc => JSON.stringify(tc.result)),
    ].join(' ');

    return allContent.includes(searchValue);
  }

  /**
   * Find tool call by name
   */
  findToolCall(trace: TraceData, toolName: string): ToolCallTrace | undefined {
    return trace.toolCalls.find(tc => tc.name === toolName);
  }

  /**
   * Check if tool was denied (permission error)
   */
  wasToolDenied(trace: TraceData, toolName: string): boolean {
    const toolCall = this.findToolCall(trace, toolName);
    if (!toolCall) return false;

    return (
      toolCall.status === 'ERROR' &&
      (toolCall.errorMessage?.toLowerCase().includes('permission') ||
       toolCall.errorMessage?.toLowerCase().includes('denied') ||
       toolCall.errorMessage?.toLowerCase().includes('rbac'))
    );
  }
}
