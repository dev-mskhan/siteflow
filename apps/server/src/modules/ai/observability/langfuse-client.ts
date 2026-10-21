// apps/server/src/modules/ai/observability/langfuse-client.ts
// Lazy singleton for the official Langfuse client.
// Tracing is purely optional; returns undefined when keys are not provided.

import { Langfuse } from 'langfuse';
import { serverEnv } from '../../../config/env.js';

let _client: Langfuse | undefined;

export function getLangfuseClient(): Langfuse | undefined {
  if (_client) return _client;
  if (!serverEnv.LANGFUSE_PUBLIC_KEY || !serverEnv.LANGFUSE_SECRET_KEY) {
    return undefined;
  }
  _client = new Langfuse({
    publicKey: serverEnv.LANGFUSE_PUBLIC_KEY,
    secretKey: serverEnv.LANGFUSE_SECRET_KEY,
    baseUrl: serverEnv.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
    flushAt: 10,
    flushInterval: 5000,
  });
  return _client;
}

export async function flushLangfuse(): Promise<void> {
  await _client?.flushAsync();
}
