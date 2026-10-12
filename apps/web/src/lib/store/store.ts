/**
 * Redux store configuration
 * RTK Query siteflowApi + future feature slices
 */

import { configureStore } from '@reduxjs/toolkit';
import { siteflowApi } from './api';

export const store = configureStore({
  reducer: {
    [siteflowApi.reducerPath]: siteflowApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(siteflowApi.middleware),
  devTools: Boolean(import.meta.env.DEV),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
