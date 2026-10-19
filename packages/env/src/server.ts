import dotenv from 'dotenv';
import path from 'node:path';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Pre-load dotenv from process.cwd() and monorepo root parent directories
const cwd = process.cwd();
dotenv.config({
  path: [path.resolve(cwd, '.env'), path.resolve(cwd, '../../.env'), path.resolve(cwd, '../.env')],
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
    DB_POOL_MAX: z.coerce.number().default(20),
    DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
    DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().default(5000),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().default(20000),

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
    STORAGE_PRESIGN_EXPIRY_SECONDS: z.coerce.number().int().min(1).max(604800).default(3600),
    EXPIRY_SCAN_DAYS_AHEAD: z.coerce.number().int().min(1).max(90).default(30),

    // OTEL
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
    OTEL_SERVICE_NAME: z.string().default('siteflow-server'),

    // Auth / JWT
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters')
      .default('change-me-please-at-least-32-chars-long!!'),
    JWT_EXPIRY: z.string().default('15m'),
    COOKIE_SECRET: z
      .string()
      .min(32, 'COOKIE_SECRET must be at least 32 characters')
      .default('change-me-cookie-secret-32-chars!!'),
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

    // CORS
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    // Request timeout (ms)
    REQUEST_TIMEOUT_MS: z.coerce.number().default(25000),
    BODY_LIMIT_BYTES: z.coerce.number().default(1048576),
    REPORT_EXPORT_SYNC_REPORT_TYPES: z
      .string()
      .default('PROJECT_HEALTH')
      .transform((value) => value.split(',').map((reportType) => reportType.trim()).filter(Boolean))
      .pipe(
        z.array(
          z.enum([
            'PROJECT_HEALTH',
            'SCHEDULE_VARIANCE_PROGRESS',
            'COMMERCIAL_FINANCIAL_SUMMARY',
            'SUBCONTRACTOR_PERFORMANCE',
            'ORGANIZATION_PORTFOLIO',
            'PROJECT_EXECUTIVE_SUMMARY',
          ]),
        ),
      ),
    REPORT_EXPORT_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    REPORT_EXPORT_SIGNED_URL_EXPIRY_SECONDS: z.coerce.number().int().min(60).max(604800).default(300),

    // Stripe test and live credentials remain separate; billing defaults to Test Mode.
    STRIPE_MODE: z.enum(['test', 'live']).default('test'),
    STRIPE_TEST_SECRET_KEY: z.string().startsWith('sk_test_').optional(),
    STRIPE_LIVE_SECRET_KEY: z.string().startsWith('sk_live_').optional(),
    STRIPE_PORTAL_CONFIGURATION_ID: z.string().startsWith('bpc_').optional(),
    STRIPE_TEST_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
    STRIPE_LIVE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

    // Platform operator bootstrap (one-time grant of platform_admin on startup)
    PLATFORM_BOOTSTRAP_EMAIL: z.string().email().optional(),

    // Logging
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

    // AI / LLM
    OPENAI_API_KEY: z.string().optional(),
    /** Concrete model name for the "cheap" tier (fast, low cost) */
    AI_MODEL_CHEAP: z.string().default('gpt-4o-mini'),
    /** Concrete model name for the "strong" tier (capable, higher cost) */
    AI_MODEL_STRONG: z.string().default('gpt-4o'),
    /** Hard daily spend cap per organisation in USD (0 = unlimited) */
    AI_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(5.0),
    /** Hard token cap per single run (input + output combined) */
    AI_RUN_MAX_TOKENS: z.coerce.number().int().positive().default(50000),
    /** Timeout per run in milliseconds */
    AI_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
    /** Max LangGraph steps per run */
    AI_RUN_MAX_STEPS: z.coerce.number().int().positive().default(20),
    /** Max tool calls per run */
    AI_RUN_MAX_TOOL_CALLS: z.coerce.number().int().positive().default(15),
    /** Langfuse public key (optional — tracing disabled when absent) */
    LANGFUSE_PUBLIC_KEY: z.string().optional(),
    /** Langfuse secret key */
    LANGFUSE_SECRET_KEY: z.string().optional(),
    /** Langfuse host — defaults to Langfuse Cloud */
    LANGFUSE_HOST: z.string().url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

if (serverEnv.NODE_ENV === 'production') {
  const DEFAULT_JWT_SECRET = 'change-me-please-at-least-32-chars-long!!';
  const DEFAULT_COOKIE_SECRET = 'change-me-cookie-secret-32-chars!!';
  if (serverEnv.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error('FATAL CONFIGURATION ERROR: JWT_SECRET cannot use the placeholder default in production mode.');
  }
  if (serverEnv.COOKIE_SECRET === DEFAULT_COOKIE_SECRET) {
    throw new Error('FATAL CONFIGURATION ERROR: COOKIE_SECRET cannot use the placeholder default in production mode.');
  }
}

export type ServerEnv = typeof serverEnv;
