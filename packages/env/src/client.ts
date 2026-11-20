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
    // Plan prices — set in .env, baked into the bundle at build time by Vite
    VITE_PLAN_STARTER_PRICE_USD: z.coerce.number().default(199),
    VITE_PLAN_STARTER_PRICE_PKR: z.coerce.number().default(49700),
    VITE_PLAN_PROFESSIONAL_PRICE_USD: z.coerce.number().default(499),
    VITE_PLAN_PROFESSIONAL_PRICE_PKR: z.coerce.number().default(124700),
    VITE_PLAN_ENTERPRISE_PRICE_USD: z.coerce.number().default(999),
    VITE_PLAN_ENTERPRISE_PRICE_PKR: z.coerce.number().default(249700),
  },
  runtimeEnv: {
    VITE_API_URL: getImportMetaEnv('VITE_API_URL') ?? process.env['VITE_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'],
    VITE_OTEL_ENDPOINT: getImportMetaEnv('VITE_OTEL_ENDPOINT') ?? process.env['VITE_OTEL_ENDPOINT'] ?? process.env['NEXT_PUBLIC_OTEL_ENDPOINT'],
    VITE_PLAN_STARTER_PRICE_USD: getImportMetaEnv('VITE_PLAN_STARTER_PRICE_USD') ?? process.env['VITE_PLAN_STARTER_PRICE_USD'],
    VITE_PLAN_STARTER_PRICE_PKR: getImportMetaEnv('VITE_PLAN_STARTER_PRICE_PKR') ?? process.env['VITE_PLAN_STARTER_PRICE_PKR'],
    VITE_PLAN_PROFESSIONAL_PRICE_USD: getImportMetaEnv('VITE_PLAN_PROFESSIONAL_PRICE_USD') ?? process.env['VITE_PLAN_PROFESSIONAL_PRICE_USD'],
    VITE_PLAN_PROFESSIONAL_PRICE_PKR: getImportMetaEnv('VITE_PLAN_PROFESSIONAL_PRICE_PKR') ?? process.env['VITE_PLAN_PROFESSIONAL_PRICE_PKR'],
    VITE_PLAN_ENTERPRISE_PRICE_USD: getImportMetaEnv('VITE_PLAN_ENTERPRISE_PRICE_USD') ?? process.env['VITE_PLAN_ENTERPRISE_PRICE_USD'],
    VITE_PLAN_ENTERPRISE_PRICE_PKR: getImportMetaEnv('VITE_PLAN_ENTERPRISE_PRICE_PKR') ?? process.env['VITE_PLAN_ENTERPRISE_PRICE_PKR'],
  },
  emptyStringAsUndefined: true,
});

export type ClientEnv = typeof clientEnv;
