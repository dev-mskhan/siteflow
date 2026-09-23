import dotenv from 'dotenv';
import path from 'node:path';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Pre-load dotenv from process.cwd() and monorepo root parent directories
const cwd = process.cwd();
dotenv.config({
  path: [
    path.resolve(cwd, '.env'),
    path.resolve(cwd, '../../.env'),
    path.resolve(cwd, '../.env'),
  ],
});

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
    DATABASE_URL: z.string().url().default('postgres://siteflow:siteflow@localhost:5434/siteflow'),

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

    // Auth / JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default('change-me-please-at-least-32-chars-long!!'),
    JWT_EXPIRY: z.string().default('15m'),
    COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters').default('change-me-cookie-secret-32-chars!!'),
    REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),

    // SMTP / Email
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('SiteFlow <noreply@siteflow.dev>'),

    // Google OAuth 2.0
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().default('http://localhost:3000/api/v1/auth/google/callback'),
    FRONTEND_URL: z.string().url().optional(),

    // Logging
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type ServerEnv = typeof serverEnv;
