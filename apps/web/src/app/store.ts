import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { baseApi } from '../services/baseApi';
import authReducer from '../features/auth/authSlice';
import orgReducer from '../features/org/orgSlice';
import projectReducer from '../features/project/projectSlice';
import { projectApi } from '../features/project/projectApi';
import { phaseApi } from '../features/project/phaseApi';
import { costCodeApi } from '../features/project/costCodeApi';
import { budgetApi } from '../features/project/budgetApi';
import { projectMemberApi } from '../features/project/projectMemberApi';
import { projectSettingsApi } from '../features/project/projectSettingsApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]:            baseApi.reducer,
    [projectApi.reducerPath]:         projectApi.reducer,
    [phaseApi.reducerPath]:           phaseApi.reducer,
    [costCodeApi.reducerPath]:        costCodeApi.reducer,
    [budgetApi.reducerPath]:          budgetApi.reducer,
    [projectMemberApi.reducerPath]:   projectMemberApi.reducer,
    [projectSettingsApi.reducerPath]: projectSettingsApi.reducer,
    auth:    authReducer,
    org:     orgReducer,
    project: projectReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      baseApi.middleware,
      projectApi.middleware,
      phaseApi.middleware,
      costCodeApi.middleware,
      budgetApi.middleware,
      projectMemberApi.middleware,
      projectSettingsApi.middleware,
    ),
  devTools: import.meta.env.DEV,
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
