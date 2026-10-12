import React from 'react';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { store } from './store';
import { ToastProvider } from '../components/ui/Toast';

export interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <HelmetProvider>
      <Provider store={store}>
        <ToastProvider>{children}</ToastProvider>
      </Provider>
    </HelmetProvider>
  );
};
