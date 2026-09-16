import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const getImportMetaEnv = (key: string) => {
  try {
    return (import.meta as any)?.env?.[key];
  } catch {
    return undefined;
  }
};

/**
 * Validated public environment variables exposed to the browser.
 * Prefixed with VITE_ or NEXT_PUBLIC_.
 */
export const clientEnv = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: z.string().url().default('http://localhost:3000'),
    VITE_OTEL_ENDPOINT: z.string().url().optional(),
  },
  runtimeEnv: {
    VITE_API_URL: getImportMetaEnv('VITE_API_URL') ?? process.env['VITE_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'],
    VITE_OTEL_ENDPOINT: getImportMetaEnv('VITE_OTEL_ENDPOINT') ?? process.env['VITE_OTEL_ENDPOINT'] ?? process.env['NEXT_PUBLIC_OTEL_ENDPOINT'],
  },
  emptyStringAsUndefined: true,
});

export type ClientEnv = typeof clientEnv;
