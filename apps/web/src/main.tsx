import React from 'react';
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
        <RouterProvider router={router} />
      </DevTestProvider>
    </Providers>
  </React.StrictMode>,
);
