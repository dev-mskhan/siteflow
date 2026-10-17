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
import { supplierApi } from '../features/supplier/supplierApi';
import { materialApi } from '../features/material/materialApi';
import { fieldLogApi } from '../api/fieldLogApi';
import { issueApi } from '../api/issueApi';
import { taskApi } from '../api/taskApi';
import { procurementApi } from '../api/procurementApi';
import { ROLE_PERMISSIONS } from '../lib/permissions';

// ── Dev bypass — seed state synchronously at store creation ──────────────────
// This runs before the first render so RequireAuth / OrgBootstrap see the seeded
// state immediately and never block or spin.
const bypass = import.meta.env.VITE_DEV_BYPASS === 'true';

const devPreloadedState = bypass
  ? {
      auth: {
        user: {
          id: 'usr_01',
          email: 'tariq@company.com',
          firstName: 'Tariq',
          lastName: 'Mehmood',
          status: 'ACTIVE' as const,
          emailVerified: true,
          lastLoginAt: new Date().toISOString(),
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        isAuthenticated: true,
        isInitialized: true,
        accessToken: null,
        sessionExpired: false,
      },
      org: {
        activeOrg: {
          id: 'org_01',
          name: 'Mehmood Civil Construction',
          slug: 'mehmood-civil',
          status: 'ACTIVE' as const,
          createdBy: 'usr_01',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        membership: {
          id: 'mem_01',
          organizationId: 'org_01',
          userId: 'usr_01',
          roleId: 'role_admin_01',
          roleName: 'Organization Admin',
          userEmail: 'tariq@company.com',
          userFirstName: 'Tariq',
          userLastName: 'Mehmood',
          status: 'ACTIVE' as const,
          joinedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        permissions: ROLE_PERMISSIONS['Organization Admin'] ?? [],
        isOrgInitialized: true,
        isOrgLoading: false,
      },
    }
  : undefined;

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    [projectApi.reducerPath]: projectApi.reducer,
    [phaseApi.reducerPath]: phaseApi.reducer,
    [costCodeApi.reducerPath]: costCodeApi.reducer,
    [budgetApi.reducerPath]: budgetApi.reducer,
    [projectMemberApi.reducerPath]: projectMemberApi.reducer,
    [projectSettingsApi.reducerPath]: projectSettingsApi.reducer,
    [supplierApi.reducerPath]: supplierApi.reducer,
    [materialApi.reducerPath]: materialApi.reducer,
    [fieldLogApi.reducerPath]: fieldLogApi.reducer,
    [issueApi.reducerPath]: issueApi.reducer,
    [taskApi.reducerPath]: taskApi.reducer,
    [procurementApi.reducerPath]: procurementApi.reducer,
    auth: authReducer,
    org: orgReducer,
    project: projectReducer,
  },
  // Synchronous pre-seed: state is correct on render #1 — guards never block
  preloadedState: devPreloadedState,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      baseApi.middleware,
      projectApi.middleware,
      phaseApi.middleware,
      costCodeApi.middleware,
      budgetApi.middleware,
      projectMemberApi.middleware,
      projectSettingsApi.middleware,
      supplierApi.middleware,
      materialApi.middleware,
      fieldLogApi.middleware,
      issueApi.middleware,
      taskApi.middleware,
      procurementApi.middleware,
    ),
  devTools: import.meta.env.DEV,
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
