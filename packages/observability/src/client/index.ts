/**
 * Client-side observability shim.
 * Uses the OpenTelemetry Web SDK + a lightweight fetch-based OTLP exporter.
 * Attach to your web app's entry point.
 */
export interface ClientTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  enabled?: boolean;
}

/**
 * Initialise browser-side OpenTelemetry.
 * Call once at your app entry point (e.g. Next.js `instrumentation.ts` client side).
 */
export async function initClientTelemetry(config: ClientTelemetryConfig): Promise<void> {
  const { serviceName, serviceVersion = '0.0.0', enabled = true } = config;

  if (!enabled || typeof globalThis.window === 'undefined') return;

  // Lazy-load browser SDK to keep the server bundle clean
  const [
    { WebTracerProvider },
    { OTLPTraceExporter },
    { BatchSpanProcessor },
    { Resource },
    { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION },
  ] = await Promise.all([
    import('@opentelemetry/sdk-trace-web'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/sdk-trace-base'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
  ]);

  const endpoint =
    config.otlpEndpoint ??
    (typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_OTEL_ENDPOINT'] : undefined) ??
    'http://localhost:4318';

  const provider = new WebTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      ),
    ],
  });

  provider.register();
}
