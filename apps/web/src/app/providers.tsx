import React from 'react';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { store } from './store';
import { ToastProvider } from '../components/ui/Toast';
import { AuthBootstrap } from '../features/auth/AuthBootstrap';

export interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <HelmetProvider>
      <Provider store={store}>
        <ToastProvider>
          {/*
            AuthBootstrap calls GET /auth/me on every cold mount.
            It shows a full-page spinner for the single async tick
            before the response arrives, then populates authSlice
            so every component can read useAuth() synchronously.
          */}
          <AuthBootstrap>{children}</AuthBootstrap>
        </ToastProvider>
      </Provider>
    </HelmetProvider>
  );
};
