/**
 * DevTestProvider — no-op wrapper kept for import compatibility.
 * The actual bypass seeding happens synchronously in store.ts via preloadedState.
 * This component does nothing — it just passes children through.
 */
import React from 'react';

export const DevTestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
