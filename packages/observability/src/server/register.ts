// @siteflow/observability — ESM preload hook
//
// This file is designed to be loaded via Node's --import flag (or tsx's --import):
//   tsx --import @siteflow/observability/server/register src/index.ts
//
// Node evaluates --import modules synchronously before the entry point's
// static imports are resolved, so the OTel SDK gets to patch pg, ioredis,
// pino, fastify etc. before they are first required — eliminating the
// "Module X has been loaded before instrumentation" warnings.
//
// The service name and OTLP endpoint are read from env vars set in the
// shell / docker-compose environment:
//   OTEL_SERVICE_NAME           — defaults to "siteflow-server"
//   OTEL_EXPORTER_OTLP_ENDPOINT — defaults to "http://localhost:4318"
import { initTelemetry } from './index.js';

initTelemetry({
  serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'siteflow-server',
  otlpEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
});
