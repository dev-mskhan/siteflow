// apps/server/src/index.ts — HTTP server entry point
//
// ⚠️  OTEL MUST be initialised before any other module import.
//     The NodeSDK hooks Node's module system; importing app code first
//     means auto-instrumentation misses all early require/import calls.
import { initTelemetry } from '@siteflow/observability/server';

initTelemetry({
  serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'siteflow-server',
  otlpEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
});

// ─── Remaining imports (after OTEL bootstrap) ─────────────────────────────────
import { buildApp } from './app/index.js';
import { serverEnv } from './config/env.js';

const start = async () => {
  const app = await buildApp();

  try {
    await app.listen({ port: serverEnv.PORT, host: serverEnv.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
