// @siteflow/observability — server-side OTEL SDK initializer
// Must be imported BEFORE any other module in the process entry point.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  /** Disable in test environments */
  enabled?: boolean;
}

let sdk: NodeSDK | undefined;

/**
 * Bootstrap OpenTelemetry SDK for server-side Node.js.
 * Call this at the very top of your process entry point, before any imports.
 *
 * @example
 * // apps/server/src/index.ts
 * import { initTelemetry } from '@siteflow/observability/server';
 * initTelemetry({ serviceName: 'siteflow-server' });
 */
export function initTelemetry(config: TelemetryConfig): void {
  const { serviceName, serviceVersion = '0.0.0', otlpEndpoint, enabled = true } = config;

  if (!enabled || process.env.NODE_ENV === 'test') {
    return;
  }

  const endpoint = otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
    }),
    exportIntervalMillis: 30_000,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: metricReader as any,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.warn('[otel] SDK shut down successfully'))
      .catch((err) => console.error('[otel] SDK shutdown error', err));
  });
}

export { NodeSDK };
export * from './logger.js';

