import 'dotenv/config';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/**
 * Validated environment variables for the server.
 * Import this instead of `process.env` to get type safety + runtime validation.
 */
export const serverEnv = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),

    // Database (PostgreSQL)
    DATABASE_URL: z.string().url().default('postgres://siteflow:siteflow@localhost:5433/siteflow'),

    // Redis
    REDIS_URL: z.string().url().default('redis://localhost:6379'),

    // MinIO / S3
    MINIO_ENDPOINT: z.string().default('localhost'),
    MINIO_PORT: z.coerce.number().default(9000),
    MINIO_ACCESS_KEY: z.string().default('minioadmin'),
    MINIO_SECRET_KEY: z.string().default('minioadmin'),
    MINIO_BUCKET_DOCUMENTS: z.string().default('siteflow-documents'),
    MINIO_USE_SSL: z
      .string()
      .transform((v) => v === 'true')
      .default('false'),

    // OTEL
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
    OTEL_SERVICE_NAME: z.string().default('siteflow-server'),

    // Logging
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type ServerEnv = typeof serverEnv;
