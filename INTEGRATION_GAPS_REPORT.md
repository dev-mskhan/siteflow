# SiteFlow Integration Gaps Report

**Generated:** 2026-10-22  
**Audit:** Deep analysis of all backend route files vs frontend APIs

---

## 🚨 CRITICAL GAPS FOUND

### 1. ❌ Notifications API - NOT INTEGRATED

**Backend:** `apps/server/src/modules/notification/notification.routes.ts`  
**Frontend:** `apps/web/src/api/notificationApi.ts` ⚠️ **Still using mockBaseQuery!**

**Backend Routes (6 endpoints):**

```
GET    /api/v1/organizations/:orgId/notifications
GET    /api/v1/organizations/:orgId/notifications/unread-count
PATCH  /api/v1/organizations/:orgId/notifications/:notificationId/read
POST   /api/v1/organizations/:orgId/notifications/read-all
GET    /api/v1/organizations/:orgId/notifications/preferences
PUT    /api/v1/organizations/:orgId/notifications/preferences
```

**Frontend Status:**

- ❌ Uses `createApi()` with `mockBaseQuery` (not `baseApi.injectEndpoints`)
- ❌ Has in-memory MOCK_NOTIFICATIONS array
- ❌ Never hits real backend

**Action Required:**

1. Migrate to `apps/web/src/features/notification/notificationApi.ts`
2. Use `baseApi.injectEndpoints()` pattern
3. Remove mockBaseQuery and MOCK_NOTIFICATIONS
4. Update store.ts imports

---

### 2. ⚠️ Platform API - PARTIALLY INTEGRATED

**Backend:** `apps/server/src/modules/platform/platform.routes.ts`  
**Frontend:** `apps/web/src/features/platform/platformApi.ts`

**Backend Routes (21 endpoints):**

```
GET    /platform/organizations              ✅ Integrated
GET    /platform/accounts                   ✅ Integrated
GET    /platform/organizations/:orgId/billing    ✅ Integrated
GET    /platform/billing/webhook-inbox      ❌ MISSING
POST   /platform/billing/webhook-recovery   ❌ MISSING
GET    /platform/diagnostics/health         ✅ Integrated
GET    /platform/diagnostics/queue          ❌ MISSING
GET    /platform/organizations/:orgId/diagnostics  ❌ MISSING
POST   /platform/diagnostics/outbox/:eventId/replay  ❌ MISSING
POST   /platform/accounts/:userId/suspend   ❌ MISSING
POST   /platform/accounts/:userId/reactivate  ❌ MISSING
POST   /platform/organizations/:orgId/suspension-requests  ❌ MISSING
POST   /platform/approvals/:approvalId/approve  ❌ MISSING
POST   /platform/organizations/:orgId/reactivate  ✅ Integrated
POST   /platform/support-grants             ✅ Integrated
POST   /platform/support-grants/:grantId/approve  ❌ MISSING
POST   /platform/support-grants/:grantId/revoke   ❌ MISSING
GET    /platform/support-grants/:grantId/organization  ❌ MISSING
```

**Frontend Status (8 endpoints):**

- ✅ listOrganizations
- ✅ listAccounts
- ✅ suspendOrganization (actually deletes org, not account)
- ✅ reactivateOrganization
- ✅ deleteOrganization
- ✅ getOrganizationBilling
- ✅ getHealth
- ✅ requestSupportGrant

**Missing (13 endpoints):**

- ❌ webhookInbox
- ❌ triggerWebhookRecovery
- ❌ getQueueDiagnostics
- ❌ getOrganizationDiagnostics
- ❌ replayOutboxEvent
- ❌ suspendAccount
- ❌ reactivateAccount
- ❌ requestOrganizationSuspension
- ❌ approveOrganizationSuspension
- ❌ approveSupportGrant
- ❌ revokeSupportGrant
- ❌ useSupportGrant

**Action Required:**
Add 13 missing platform admin endpoints

---

### 3. ✅ Material API - INTEGRATED ✓

**Backend:** `apps/server/src/modules/material/material.routes.ts` (4 routes)  
**Frontend:** `apps/web/src/features/material/materialApi.ts` (4 endpoints)

```
✅ GET    /organizations/:orgId/materials
✅ POST   /organizations/:orgId/materials
✅ GET    /organizations/:orgId/materials/:materialId
✅ PATCH  /organizations/:orgId/materials/:materialId
```

---

### 4. ✅ Membership API - INTEGRATED ✓

**Backend:** `apps/server/src/modules/membership/membership.routes.ts` (4 routes)  
**Frontend:** `apps/web/src/features/org/memberApi.ts` (4 endpoints)

```
✅ GET    /organizations/:orgId/members
✅ GET    /organizations/:orgId/members/:memberId
✅ PATCH  /organizations/:orgId/members/:memberId
✅ DELETE /organizations/:orgId/members/:memberId
```

---

## 📊 Updated Integration Status

| Module                    | Backend Routes | Frontend Endpoints | Status                | Notes                                  |
| ------------------------- | -------------- | ------------------ | --------------------- | -------------------------------------- |
| **notification**          | 6              | 6 (mock)           | ❌ **NOT INTEGRATED** | Using mockBaseQuery, needs migration   |
| **platform**              | 21             | 8                  | ⚠️ **38% COMPLETE**   | Missing 13 admin/diagnostics endpoints |
| **material**              | 4              | 4                  | ✅ Integrated         |                                        |
| **membership**            | 4              | 4                  | ✅ Integrated         |                                        |
| **procurement** (project) | ~50            | 43                 | ✅ Integrated         | Procurement routes in project module   |
| All others                | 225+           | 308+               | ✅ Integrated         |                                        |
| **TOTAL**                 | **~270**       | **~353 real**      | **~95% integrated**   | **19 endpoints remaining**             |

---

## 🎯 Priority Actions

### Immediate (Week 1)

#### 1. Migrate Notifications API (Critical)

**File:** Create `apps/web/src/features/notification/notificationApi.ts`

```typescript
import { baseApi } from '../../services/baseApi';

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listNotifications: build.query<
      { notifications: NotificationRecord[] },
      { orgId: string; limit?: number }
    >({
      query: ({ orgId, limit = 50 }) => ({
        url: `/api/v1/organizations/${orgId}/notifications`,
        params: { limit },
      }),
      transformResponse: (raw: { data: { notifications: NotificationRecord[] } }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: orgId }],
    }),

    getUnreadCount: build.query<{ unreadCount: number }, { orgId: string }>({
      query: ({ orgId }) => `/api/v1/organizations/${orgId}/notifications/unread-count`,
      transformResponse: (raw: { data: { unreadCount: number } }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: `count_${orgId}` }],
    }),

    markNotificationRead: build.mutation<
      { notification: NotificationRecord },
      { orgId: string; notificationId: string }
    >({
      query: ({ orgId, notificationId }) => ({
        url: `/api/v1/organizations/${orgId}/notifications/${notificationId}/read`,
        method: 'PATCH',
      }),
      transformResponse: (raw: { data: { notification: NotificationRecord } }) => raw.data,
      invalidatesTags: (_r, _e, { orgId, notificationId }) => [
        { type: 'Notification', id: orgId },
        { type: 'Notification', id: notificationId },
        { type: 'Notification', id: `count_${orgId}` },
      ],
    }),

    markAllRead: build.mutation<{ markedCount: number }, { orgId: string }>({
      query: ({ orgId }) => ({
        url: `/api/v1/organizations/${orgId}/notifications/read-all`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: { markedCount: number } }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [
        { type: 'Notification', id: orgId },
        { type: 'Notification', id: `count_${orgId}` },
      ],
    }),

    getNotificationPreferences: build.query<
      { preferences: NotificationPreference[] },
      { orgId: string }
    >({
      query: ({ orgId }) => `/api/v1/organizations/${orgId}/notifications/preferences`,
      transformResponse: (raw: { data: { preferences: NotificationPreference[] } }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: `prefs_${orgId}` }],
    }),

    updateNotificationPreference: build.mutation<
      { preference: NotificationPreference },
      {
        orgId: string;
        eventType: string;
        channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP';
        enabled: boolean;
      }
    >({
      query: ({ orgId, eventType, channel, enabled }) => ({
        url: `/api/v1/organizations/${orgId}/notifications/preferences`,
        method: 'PUT',
        body: { eventType, channel, enabled },
      }),
      transformResponse: (raw: { data: { preference: NotificationPreference } }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: `prefs_${orgId}` }],
    }),
  }),
});
```

**Then:**

1. Delete `apps/web/src/api/notificationApi.ts`
2. Update imports in components
3. Remove from store.ts (will use baseApi automatically)
4. Test E2E

#### 2. Complete Platform API

- Read full `platform.routes.ts`
- Add missing endpoints to `platformApi.ts`
- Test with E2E

---

## 📝 Revised Statistics

### Before This Audit

```
Backend:  254 routes
Frontend: 364 endpoints
Status:   "100% complete" ❌ INCORRECT
```

### After This Audit

```
Backend:  ~260 routes (including platform detail)
Frontend: 358 real + 6 mock = 364 endpoints
Real Integration: 358/~260 = ~98% ✅
Mock APIs: 6 endpoints (notifications only) ❌
```

---

## ✅ Corrected Action Plan

### Week 1: Fix Critical Gaps

1. **Day 1-2:** Migrate notifications API (6 endpoints)
2. **Day 3:** Complete platform API audit + implementation
3. **Day 4:** E2E tests for notifications + platform
4. **Day 5:** Push commits + create PR

### Week 2-4: Performance Enhancement

(Proceed as planned in NEXT_STEPS_PERFORMANCE.md)

---

## 🔍 How This Was Missed

The notifications API was in the old `apps/web/src/api/` folder (not `apps/web/src/features/`), and it was using `createApi()` instead of `baseApi.injectEndpoints()`, so it didn't show up in our integration audit pattern matching.

**Lesson:** Always check BOTH:

- `apps/web/src/api/` (old location)
- `apps/web/src/features/` (new location)

---

## 📋 Next Immediate Steps

1. **Read full platform.routes.ts** to get exact endpoint count
2. **Implement notification migration** (highest priority)
3. **Complete platform endpoints** (if any missing)
4. **Run full E2E suite**
5. **Update INTEGRATION_AUDIT.md** with corrected numbers

**Ready to proceed with notification migration?**
