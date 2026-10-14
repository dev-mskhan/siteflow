# SiteFlow Frontend Integration Reference

**Status:** Living document — update each module section as work progresses.  
**Last updated:** October 2026  
**Stack:** React 18 · RTK Query (bundled in @reduxjs/toolkit 2.5.x) · react-redux 9 · Zod · react-router-dom v7 · Tailwind CSS v4

---

## 1. Overall Strategy

### Two-phase per module

```
Phase A — Mock-first
  Read server route file + @siteflow/shared schema
  → Write typed fixture file  (src/mocks/<module>.fixtures.ts)
  → Build all screens against fixtures
  → UI is fully functional, zero network calls

Phase B — Real integration (one module at a time)
  Replace fixture import with RTK Query hook
  Components do NOT change — only the data source changes
  → This is the only acceptable integration path
```

**The golden rule:** A component must never call `fetch` or `axios` directly.  
All server state flows through RTK Query. All local UI state (modal open, wizard step, active tab) lives in Zustand.

### Auth is the exception

Auth is the only module integrated immediately from real API.  
Every other module starts in Phase A.

---

## 2. Package & Workspace Setup

### Add `@siteflow/shared` to the web app

```bash
# from repo root
pnpm add @siteflow/shared --filter @siteflow/web --workspace
```

`apps/web/package.json` should gain:
```json
"@siteflow/shared": "workspace:*"
```

This gives the web app direct access to every Zod schema and TypeScript type without duplication.  
Import path: `import { UserDTO, loginSchema } from '@siteflow/shared'`

### RTK Query is already available

`@reduxjs/toolkit 2.5.1` bundles RTK Query — no extra install needed.  
`react-redux 9.2.0` is already installed.

### What needs to be created

```
apps/web/src/
  store/
    index.ts               ← configureStore, exports RootState + AppDispatch
    api/
      baseApi.ts           ← createApi with fetchBaseQuery, cookie credentials
      authApi.ts           ← auth endpoints injected into baseApi
      <module>Api.ts       ← one file per module, added as phases progress
  features/
    auth/
      authSlice.ts         ← user + isAuthenticated state in Redux
      useAuth.ts           ← convenience selector hook
  mocks/
    auth.fixtures.ts       ← typed mock data matching UserDTO / SessionDTO
    <module>.fixtures.ts   ← added per module before Phase B
```

---

## 3. RTK Query Base Setup

### `src/store/api/baseApi.ts`

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
    // Server sets HttpOnly cookies — browser sends them automatically.
    // credentials: 'include' is required for cross-origin cookie transport.
    credentials: 'include',
    // Attach Authorization header from Redux state as a fallback
    // (for environments where cookies are blocked).
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as any).auth?.accessToken;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  // Tag types for cache invalidation — grow this list as modules are added
  tagTypes: ['User', 'Session'],
  // All endpoints are injected from module-specific files
  endpoints: () => ({}),
});
```

### `src/store/index.ts`

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### `src/main.tsx` — wrap with Provider

```tsx
import { Provider } from 'react-redux';
import { store } from './store';

<Provider store={store}>
  <App />
</Provider>
```

---

## 4. Token & Cookie Strategy

The server uses **HttpOnly signed cookies** for both tokens, not localStorage.

| Token | Cookie name | HttpOnly | Expires |
|---|---|---|---|
| Access token (JWT) | `access_token` | Yes | ~15 min |
| Refresh token | `refresh_token` | Yes | ~30 days |

**Implications for the frontend:**

1. **Never store tokens in localStorage or JS variables** — they arrive and leave via Set-Cookie headers automatically.
2. **Every RTK Query call must include `credentials: 'include'`** — already set in `baseApi`.
3. **Automatic token refresh** — implement a `baseQueryWithReauth` wrapper (see §4.1).
4. **The `useAuthState` hook we built** reads `access_token` from localStorage as a stub. When real auth lands, replace it with a Redux selector `(state) => state.auth.isAuthenticated`.

### 4.1 `baseQueryWithReauth` — silent refresh

Wrap `fetchBaseQuery` to automatically retry with a refresh call on 401:

```typescript
// src/store/api/baseApi.ts (full version)
import { fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  credentials: 'include',
});

export const baseQueryWithReauth: BaseQueryFn = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    // Try refreshing — POST /auth/refresh reads the HttpOnly cookie automatically
    const refreshResult = await rawBaseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions,
    );

    if (refreshResult.data) {
      // Retry the original request with the new cookie the server just set
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      // Refresh also failed — user must log in again
      api.dispatch(authLoggedOut()); // action from authSlice
    }
  }

  return result;
};
```

---

## 5. Auth Module — Real API Integration

### 5.1 Endpoints reference

All auth endpoints are under **`/api/v1/auth`**.

| Method | Path | Auth required | Purpose |
|---|---|---|---|
| POST | `/auth/register` | No | Create account + start session |
| POST | `/auth/login` | No | Credential login + start session |
| GET | `/auth/google` | No | Get Google OAuth redirect URL |
| GET | `/auth/google/callback?code=` | No | Exchange code, create/link account |
| POST | `/auth/refresh` | No (cookie) | Rotate refresh token, issue new cookies |
| POST | `/auth/verify-email` | No | Confirm email with token from inbox |
| POST | `/auth/resend-verification` | No | Re-send verification email |
| POST | `/auth/forgot-password` | No | Request password reset email |
| POST | `/auth/reset-password` | No | Reset password with token from email |
| POST | `/auth/logout` | Yes | Revoke current session, clear cookies |
| POST | `/auth/change-password` | Yes | Change password, revoke all sessions |
| GET | `/auth/me` | Yes | Get current user profile |
| GET | `/auth/sessions` | Yes | List all active sessions |
| DELETE | `/auth/sessions/:sessionId` | Yes | Revoke a specific session |
| POST | `/auth/logout-all` | Yes | Revoke all sessions across all devices |

### 5.2 Request / Response shapes

All response bodies follow the envelope:
```typescript
// Success
{ success: true, data: T, meta?: { timestamp: string } }

// Error
{ success: false, error: { code: string, message: string, requestId?: string } }
```

#### POST `/auth/register`

```typescript
// Request body — matches RegisterInput from @siteflow/shared
{
  email: string;       // trimmed, lowercased
  password: string;    // min 8 chars, uppercase + number + special char required
  firstName: string;   // min 1, max 50
  lastName?: string;   // optional
}

// Response 201
{
  success: true;
  data: { user: UserDTO };
}
// Tokens arrive as Set-Cookie headers — no token in body
```

#### POST `/auth/login`

```typescript
// Request body
{ email: string; password: string; }

// Response 200
{ success: true; data: { user: UserDTO }; }

// Error 401: { code: 'UNAUTHORIZED', message: 'Invalid email or password' }
// Error 429: { code: 'TOO_MANY_REQUESTS', message: 'Too many failed login attempts...' }
//   Rate limit: 5 attempts per 15 min per email+IP combination
```

#### GET `/auth/me`

```typescript
// Response 200
{ success: true; data: { user: UserDTO }; }

// UserDTO shape (from @siteflow/shared)
interface UserDTO {
  id: string;                          // e.g. 'usr_01J9Z0F8QPXKMPQ1VRFP1D5K3B'
  email: string;
  firstName: string;
  lastName: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  emailVerified: boolean;
  lastLoginAt: string | null;          // ISO 8601
  createdAt: string;                   // ISO 8601
}
```

#### GET `/auth/sessions`

```typescript
// Response 200
{
  success: true;
  data: {
    sessions: SessionDTO[];
  };
}

// SessionDTO shape (from @siteflow/shared)
interface SessionDTO {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string | null;           // ISO 8601
  createdAt: string;                   // ISO 8601
  isCurrent?: boolean;                 // true only on the session making the request
}
```

#### POST `/auth/verify-email`

```typescript
// Request body
{ token: string; }  // 64-char hex token from email link

// Response 200: { success: true, data: { message: 'Email verified successfully' } }
// Error 400: token expired or already used
```

#### POST `/auth/forgot-password` / POST `/auth/reset-password`

```typescript
// forgot-password request
{ email: string; }
// Always returns 200 regardless of whether email exists (prevents enumeration)

// reset-password request
{ token: string; newPassword: string; }
// Invalidates ALL existing sessions after success
```

### 5.3 Validation — use shared Zod schemas

```typescript
// In login form
import { loginSchema } from '@siteflow/shared';
// Pair with react-hook-form resolver:
import { zodResolver } from '@hookform/resolvers/zod';
const { register, handleSubmit } = useForm({ resolver: zodResolver(loginSchema) });
```

The same Zod schemas the server validates with are available to the frontend — no drift possible.

### 5.4 Auth RTK Query endpoints

```typescript
// src/store/api/authApi.ts
import { baseApi } from './baseApi';
import type { UserDTO, SessionDTO } from '@siteflow/shared';

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    login: build.mutation<{ user: UserDTO }, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      // On success, invalidate the User cache so /me is re-fetched
      invalidatesTags: ['User'],
    }),

    register: build.mutation<
      { user: UserDTO },
      { email: string; password: string; firstName: string; lastName?: string }
    >({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),

    logout: build.mutation<{ message: string }, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      // After logout, invalidate ALL cached data
      invalidatesTags: (result, error, arg) => baseApi.util.getRunningQueriesThunk()
        ? [{ type: 'User' }, { type: 'Session' }]
        : [],
    }),

    getMe: build.query<{ user: UserDTO }, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),

    getSessions: build.query<{ sessions: SessionDTO[] }, void>({
      query: () => '/auth/sessions',
      providesTags: ['Session'],
    }),

    deleteSession: build.mutation<{ message: string }, string>({
      query: (sessionId) => ({ url: `/auth/sessions/${sessionId}`, method: 'DELETE' }),
      invalidatesTags: ['Session'],
    }),

    logoutAll: build.mutation<{ message: string }, void>({
      query: () => ({ url: '/auth/logout-all', method: 'POST' }),
      invalidatesTags: ['User', 'Session'],
    }),

    verifyEmail: build.mutation<{ message: string }, { token: string }>({
      query: (body) => ({ url: '/auth/verify-email', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),

    resendVerification: build.mutation<{ message: string }, { email: string }>({
      query: (body) => ({ url: '/auth/resend-verification', method: 'POST', body }),
    }),

    forgotPassword: build.mutation<{ message: string }, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),

    resetPassword: build.mutation<{ message: string }, { token: string; newPassword: string }>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),

    changePassword: build.mutation<
      { message: string },
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
      invalidatesTags: ['Session'],
    }),

  }),
  overrideExisting: false,
});

// Export typed hooks — generated automatically by RTK Query
export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetMeQuery,
  useGetSessionsQuery,
  useDeleteSessionMutation,
  useLogoutAllMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
} = authApi;
```

### 5.5 Auth Redux slice — global auth state

```typescript
// src/features/auth/authSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../store/api/authApi';
import type { UserDTO } from '@siteflow/shared';

interface AuthState {
  user: UserDTO | null;
  isAuthenticated: boolean;
  isInitialized: boolean; // true after first /me call settles
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authLoggedOut: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
  extraReducers: (builder) => {
    // Sync Redux state whenever /me resolves
    builder.addMatcher(authApi.endpoints.getMe.matchFulfilled, (state, { payload }) => {
      state.user = payload.user;
      state.isAuthenticated = true;
      state.isInitialized = true;
    });
    builder.addMatcher(authApi.endpoints.getMe.matchRejected, (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
    });
    // Sync on login / register too
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      state.user = payload.user;
      state.isAuthenticated = true;
      state.isInitialized = true;
    });
    builder.addMatcher(authApi.endpoints.register.matchFulfilled, (state, { payload }) => {
      state.user = payload.user;
      state.isAuthenticated = true;
      state.isInitialized = true;
    });
    // Clear on logout
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
    });
    builder.addMatcher(authApi.endpoints.logoutAll.matchFulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
    });
  },
});

export const { authLoggedOut } = authSlice.actions;
export default authSlice.reducer;
```

### 5.6 `useAuth` convenience hook

```typescript
// src/features/auth/useAuth.ts
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

export function useAuth() {
  const { user, isAuthenticated, isInitialized } = useSelector(
    (state: RootState) => state.auth,
  );
  return { user, isAuthenticated, isInitialized };
}
```

Usage in any component:
```typescript
const { user, isAuthenticated, isInitialized } = useAuth();
if (!isInitialized) return <Spinner />;
if (!isAuthenticated) return <Navigate to="/login" />;
```

### 5.7 App bootstrap — call `/me` on mount

```typescript
// src/App.tsx or src/features/auth/AuthBootstrap.tsx
import { useGetMeQuery } from './store/api/authApi';

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  // This call fires on every page load.
  // If the HttpOnly cookie is valid → user is loaded into Redux.
  // If cookie is expired → baseQueryWithReauth tries /refresh.
  // If refresh fails → authLoggedOut is dispatched.
  const { isLoading } = useGetMeQuery();

  if (isLoading) return <AppLoadingScreen />;
  return <>{children}</>;
}
```

---

## 6. Server Error Codes Reference

All error responses follow `{ success: false, error: { code, message, requestId? } }`.

| HTTP | code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing or invalid token / wrong password |
| 403 | `FORBIDDEN` | Account suspended / insufficient permission |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Email already registered |
| 422 | `VALIDATION_ERROR` | Schema validation failed |
| 429 | `TOO_MANY_REQUESTS` | Rate limit hit (5 login attempts per 15 min; 3 reset emails per 15 min) |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |

Frontend error handling pattern:
```typescript
const [login, { error }] = useLoginMutation();

// RTK Query wraps server errors in { status, data }
if (error && 'data' in error) {
  const serverError = error.data as { error: { code: string; message: string } };
  if (serverError.error.code === 'TOO_MANY_REQUESTS') {
    // show rate limit message
  }
}
```

---

## 7. Auth Screens to Build

| Screen | Route | RTK hooks used |
|---|---|---|
| Login | `/login` | `useLoginMutation` |
| Register | `/register` | `useRegisterMutation` |
| Verify Email (from email link) | `/verify-email?token=` | `useVerifyEmailMutation` |
| Resend Verification | `/resend-verification` | `useResendVerificationMutation` |
| Forgot Password | `/forgot-password` | `useForgotPasswordMutation` |
| Reset Password (from email link) | `/reset-password?token=` | `useResetPasswordMutation` |
| Google OAuth callback | `/auth/callback` | redirect from server, triggers `useGetMeQuery` |
| Change Password | `/settings/security` | `useChangePasswordMutation` |
| Active Sessions | `/settings/sessions` | `useGetSessionsQuery`, `useDeleteSessionMutation`, `useLogoutAllMutation` |

### Route guard pattern

```typescript
// src/components/guards/RequireAuth.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();

  if (!isInitialized) return null; // AuthBootstrap handles the loading state
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

// Usage in router
<Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
```

---

## 8. Google OAuth Flow

The server handles the PKCE challenge and token exchange — the frontend just redirects.

```
1. User clicks "Continue with Google"
2. Frontend calls GET /auth/google → receives { data: { url: 'https://accounts.google.com/...' } }
3. Frontend does window.location.href = url  (full page redirect)
4. Google shows consent screen
5. Google redirects to server callback: GET /api/v1/auth/google/callback?code=xxx
6. Server exchanges code, creates/links account, sets HttpOnly cookies, redirects to:
     /auth/callback   (or whatever GOOGLE_REDIRECT_URI is configured to)
7. Frontend /auth/callback page calls useGetMeQuery() → loads user into Redux → redirects to /dashboard
```

---

## 9. Module Build Order (Post-Auth)

These are Phase A (mock-first) until explicitly promoted to Phase B.

| Priority | Module | Server routes prefix |
|---|---|---|
| 1 | Auth | `/api/v1/auth` ← **real API now** |
| 2 | Organization + Onboarding | `/api/v1/organizations` |
| 3 | Project list + Project detail shell | `/api/v1/organizations/:orgId/projects` |
| 4 | Budget / Cost codes | `/api/v1/organizations/:orgId/projects/:pid/cost-codes` |
| 5 | Field logs | `/api/v1/organizations/:orgId/projects/:pid/field-logs` |
| 6 | Procurement chain (MR → Quote → PO → Delivery) | project sub-routes |
| 7 | Schedule (tasks, calendar, baselines) | project sub-routes |
| 8 | Subcontractors + Payments | project sub-routes |
| 9 | Members + Invitations | `/api/v1/organizations/:orgId/members` |
| 10 | Suppliers + Materials | org-level routes |
| 11 | Reporting + Exports | `/api/v1/organizations/:orgId/reports` |
| 12 | Billing + Subscription | `/api/v1/organizations/:orgId/billing` |

---

## 10. Phase A → B Promotion Checklist

When promoting any module from mock to real API:

- [ ] Read `apps/server/src/modules/<module>/<module>.routes.ts` — extract all endpoints
- [ ] Read matching schemas in `packages/shared/src/modules/<module>/<module>.schema.ts`
- [ ] Create `src/store/api/<module>Api.ts` with RTK Query endpoints
- [ ] Add new tag types to `baseApi.ts` tagTypes array
- [ ] Replace fixture import in affected components with RTK Query hook
- [ ] Verify error handling covers all codes the server can return for that module
- [ ] Test with real dev server running — check network tab for cookie transport
- [ ] Confirm `invalidatesTags` / `providesTags` are correctly wired (no stale UI)

---

## 11. Environment Variables

```env
# apps/web/.env.local
VITE_API_URL=http://localhost:3000/api/v1
```

The server runs on port 3000 by default (`apps/server/src/config/env.ts`).  
CORS is already configured on the server to accept `http://localhost:3001` (web dev server port).

---

## 12. Replacing `useAuthState` (current stub)

The `src/hooks/useAuthState.ts` stub currently reads `localStorage`.  
Once the Redux store + `AuthBootstrap` are wired, replace the hook body:

```typescript
// Before (stub)
export function useAuthState() {
  // reads localStorage
}

// After (real)
export function useAuthState() {
  const { isAuthenticated, isInitialized } = useAuth(); // from Redux
  return {
    isLoggedIn: isAuthenticated,
    isLoading: !isInitialized,
  };
}
```

The Navbar and all other consumers of `useAuthState` need zero changes — the interface is the same.

---

*Add a new H2 section per module as each one enters Phase B.*
