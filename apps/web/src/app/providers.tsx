import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Global provider tree.
 * Add QueryClientProvider, ThemeProvider, AuthProvider etc. here as features are built.
 */
export function Providers({ children }: ProvidersProps) {
  return <>{children}</>;
}
