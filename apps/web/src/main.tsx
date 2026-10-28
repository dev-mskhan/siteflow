import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './app/providers';
import { router } from './app/router';
import { DevTestProvider } from './dev/DevTestProvider';
import { initClientTelemetry } from '@siteflow/observability/client';
import './styles/globals.css';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api/v1';
const telemetryEndpoint =
  import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT ??
  (import.meta.env.DEV ? 'http://localhost:4318' : undefined);

void initClientTelemetry({
  serviceName: 'siteflow-web',
  apiBaseUrl,
  otlpEndpoint: telemetryEndpoint,
  enabled: Boolean(telemetryEndpoint),
})
  .catch((error: unknown) => {
    console.error('Browser telemetry initialization failed', error);
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <Providers>
          {/*
            DevTestProvider is a no-op unless VITE_DEV_BYPASS=true in .env.local.
            It seeds mock auth + org state so dashboard URLs work without a server.
          */}
          <DevTestProvider>
            <Suspense
              fallback={
                <div role="status" aria-live="polite" className="p-8 font-mono text-xs text-[var(--muted)]">
                  Loading…
                </div>
              }
            >
              <RouterProvider router={router} />
            </Suspense>
          </DevTestProvider>
        </Providers>
      </React.StrictMode>,
    );
  });
