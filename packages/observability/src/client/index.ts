import {
  context,
  SpanKind,
  SpanStatusCode,
  trace,
  type Tracer,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

/**
 * Client-side observability shim.
 * Uses the OpenTelemetry Web SDK + a lightweight fetch-based OTLP exporter.
 * Attach to your web app's entry point.
 */
export interface ClientTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  apiBaseUrl?: string;
  enabled?: boolean;
}

/**
 * Initialise browser-side OpenTelemetry.
 * Call once at your app entry point (e.g. Next.js `instrumentation.ts` client side).
 */
export async function initClientTelemetry(config: ClientTelemetryConfig): Promise<void> {
  const { serviceName, serviceVersion = '0.0.0', enabled = true } = config;
  const endpoint = config.otlpEndpoint?.replace(/\/+$/, '');

  if (!enabled || !endpoint || typeof globalThis.window === 'undefined') return;

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
  const propagator = new W3CTraceContextPropagator();
  provider.register({ propagator });
  instrumentApiFetch(
    provider.getTracer('siteflow-web'),
    new URL(config.apiBaseUrl ?? '/api/v1', globalThis.location.href),
    propagator,
  );
}

function instrumentApiFetch(
  tracer: Tracer,
  apiBase: URL,
  propagator: W3CTraceContextPropagator,
): void {
  type InstrumentedFetch = typeof fetch & { siteflowInstrumented?: boolean };
  const currentFetch = globalThis.fetch as InstrumentedFetch;
  if (currentFetch.siteflowInstrumented) return;

  const originalFetch = currentFetch.bind(globalThis);
  const instrumentedFetch: InstrumentedFetch = async (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? String(input), globalThis.location.href);
    const isApiRequest =
      url.origin === apiBase.origin &&
      (url.pathname === apiBase.pathname.replace(/\/+$/, '') ||
        url.pathname.startsWith(`${apiBase.pathname.replace(/\/+$/, '')}/`));
    if (!isApiRequest) return originalFetch(input, init);

    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const normalizedPath = url.pathname
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
        '/:id',
      )
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      .replace(/\/[0-9A-HJKMNP-TV-Z]{26}(?=\/|$)/gi, '/:id');

    return tracer.startActiveSpan(
      `${method} ${normalizedPath}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.request.method': method,
          'url.full': `${url.origin}${normalizedPath}`,
          'url.template': normalizedPath,
          'siteflow.api.path': normalizedPath,
        },
      },
      async (span) => {
        const headers = new Headers(request?.headers);
        new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
        propagator.inject(trace.setSpan(context.active(), span), headers, {
          set: (carrier, key, value) => carrier.set(key, value),
        });

        try {
          const response = await originalFetch(input, { ...init, headers });
          span.setAttribute('http.response.status_code', response.status);
          if (response.status >= 400) {
            span.setAttribute('error.type', String(response.status));
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
          return response;
        } catch (error) {
          span.setAttribute('error.type', 'network_error');
          span.recordException(error instanceof Error ? error : new Error('Fetch request failed'));
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  };
  instrumentedFetch.siteflowInstrumented = true;
  globalThis.fetch = instrumentedFetch;
}
