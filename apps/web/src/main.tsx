import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './app/providers';
import { router } from './app/router';
import { DevTestProvider } from './dev/DevTestProvider';
import './styles/globals.css';

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
