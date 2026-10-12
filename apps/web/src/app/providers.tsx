import { type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from '../lib/store/store';
import { AuthBridge } from '../features/auth/components/AuthBridge';
import { ToastProvider } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Global provider tree.
 *
 * Order:
 *  1. ErrorBoundary — catches rendering crashes
 *  2. Redux Provider (RTK Query store)
 *  3. ToastProvider — global toast notifications
 *  4. AuthBridge — fires GET /auth/me on mount and handles 401 cleanup
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <ToastProvider>
          <AuthBridge>
            {children}
          </AuthBridge>
        </ToastProvider>
      </Provider>
    </ErrorBoundary>
  );
}
