# Group 13 — Notifications & Real-time (SSE)

**Status:** Not started  
**Priority:** 🔴 Critical infrastructure — must be built early, underlies all other groups  
**Depends on:** Group 1 (AppLayout — bell lives in header)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/notification/notification.routes.ts` | List notifications + mark-as-read |
| `apps/server/src/modules/notification/realtime/realtime.plugin.ts` | SSE stream endpoint |
| `apps/server/src/modules/notification/realtime/realtime.delivery.ts` | `RealtimeDeliveryManager` — server-side SSE connection pool + broadcast |
| `apps/server/src/modules/notification/realtime/realtime.authorization.ts` | `authorizeRealtimeSubscription` (tenant isolation) |
| `apps/server/src/modules/notification/notification.service.ts` | `getRecipientNotifications`, `markRead`, `markDelivered` |
| `apps/server/src/modules/notification/notification.repository.ts` | DB operations — findByRecipient, markRead |
| `apps/server/src/modules/notification/preferences/preference.service.ts` | Per-channel preference evaluation (internal only — no HTTP routes exposed yet) |
| `apps/server/src/modules/notification/event-notification.worker.ts` | Outbox event → notification worker (creates IN_APP records from domain events) |

---

## HTTP Routes

### In-App Notifications
```
GET    /api/v1/organizations/:orgId/notifications          preHandler: authenticate + organizationContext
  querystring: limit? (1-100, default 50)
  Returns: { notifications: NotificationRecord[] }

PATCH  /api/v1/organizations/:orgId/notifications/:notificationId/read   preHandler: authenticate + organizationContext
  Returns: { notification: NotificationRecord }
```

### SSE Stream
```
GET    /api/v1/organizations/:orgId/notifications/stream   preHandler: authenticate + organizationContext
  Response: text/event-stream
  - On connect: sends `data: { type: "CONNECTED", connectionId, organizationId }\n\n`
  - Ongoing: server pushes `data: { ...eventPayload }\n\n` on domain events
  - On revocation: sends `event: revoked\ndata: { reason }\n\n` then closes
  Authorization: `authorizeRealtimeSubscription(userOrgId, targetOrgId)` — tenant-isolated
```

---

## NotificationRecord Schema (from `@siteflow/database/schema`)

```ts
interface NotificationRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  recipientId: string;           // userId
  eventId: string | null;        // idempotency key — prevents duplicate notifications
  eventType: string;             // e.g. 'RfiOverdue', 'DocumentExpiring', 'procurement.purchase_order.approved'
  channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP';
  templateId: string | null;
  payload: Record<string, unknown>;  // event-specific data
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  readAt: Date | null;           // null = unread
  retryCount: number;
  lastError: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Known Event Types (from `event-notification.worker.ts` + `operations-reminders.service.ts`)

| eventType | Payload keys | Trigger |
|-----------|-------------|---------|
| `RfiOverdue` | `rfiId, subject, dueDate` | Operations reminder cron |
| `DocumentExpiring` | `documentId, name, expirationDate` | Operations reminder cron |
| `procurement.purchase_order.approved` | `organizationId, projectId, poId` | Outbox event |
| `procurement.delivery.delivered` | `organizationId, projectId, deliveryId` | Outbox event |
| `procurement.receipt.posted` | `organizationId, projectId, receiptId` | Outbox event |
| `procurement.approval.approved` | `organizationId, projectId, approvalId, resourceType, resourceId` | Outbox event |
| `procurement.approval.rejected` | same | Outbox event |
| `procurement.committed_cost.created` | `organizationId, projectId, committedCostId, poId` | Outbox event |

SSE events broadcast by `realtimeDeliveryManager.broadcastToTenant(orgId, eventData)` — all members of the org receive them.

---

## SSE Connection Lifecycle

1. Client opens `EventSource` to `.../notifications/stream`
2. Server responds with `text/event-stream` headers (no body close)
3. Server sends `CONNECTED` event with `connectionId`
4. Server pushes domain events as they occur (via `broadcastToTenant`)
5. On auth revocation: server sends `event: revoked` + closes the socket
6. Client reconnects automatically (EventSource native retry behavior)
7. Connection tracked in `RealtimeDeliveryManager.connections` Map (in-memory, per-process)

---

## Frontend Components to Build

### 13.1 `useSSE` hook — `apps/web/src/hooks/useSSE.ts`
```ts
// Connects to the SSE stream for the current org, dispatches events
// to RTK Query cache invalidations and/or a Redux slice

function useSSE(orgId: string): { isConnected: boolean; lastEvent: SSEEvent | null }
```

Implementation:
- `new EventSource('/api/v1/organizations/:orgId/notifications/stream', { withCredentials: true })`
- On `message` event: parse JSON, dispatch to RTK Query invalidation map (see below)
- On `error`: set isConnected=false, EventSource auto-reconnects
- On `revoked` named event: clear auth state, redirect to login
- Cleanup: `eventSource.close()` in useEffect cleanup
- Must handle dev bypass mode: connect to actual backend (SSE doesn't go through mock)

### 13.2 SSE → RTK Query invalidation map — `apps/web/src/lib/sseInvalidations.ts`
```ts
const SSE_INVALIDATION_MAP: Record<string, () => void> = {
  'procurement.purchase_order.approved': () => store.dispatch(procurementApi.util.invalidateTags([{ type: 'PO', id: 'LIST' }, { type: 'CommittedCost', id: 'LIST' }])),
  'procurement.delivery.delivered':      () => store.dispatch(procurementApi.util.invalidateTags([{ type: 'Delivery', id: 'LIST' }])),
  'procurement.receipt.posted':          () => store.dispatch(procurementApi.util.invalidateTags([{ type: 'Receipt', id: 'LIST' }, { type: 'Inventory', id: 'LIST' }])),
  'procurement.approval.approved':       () => store.dispatch(procurementApi.util.invalidateTags([{ type: 'Approval', id: 'LIST' }, { type: 'PO', id: 'LIST' }])),
  // ... extend as groups are built
}
```

### 13.3 `NotificationBell` component — `apps/web/src/components/notifications/NotificationBell.tsx`
```
- Fetches GET /notifications?limit=20 on mount
- Unread count badge (red dot with count) on bell icon
- Click → dropdown panel:
  - List of notifications (most recent first)
  - Each item: icon by eventType | message derived from payload | relative time | read/unread style
  - Click notification: PATCH .../notifications/:id/read → mark as read + navigate to relevant entity
  - "Mark all read" button
- Auto-refreshes when SSE delivers new notification eventType

Visual:
  - Bell icon in AppLayout header (right side)
  - Unread count: `font-mono text-[9px]` badge
  - Dropdown: `border border-[var(--hairline-2)] bg-[var(--paper)]` flat design
  - Unread items: `bg-[var(--surface-2)]` background
  - Read items: `bg-[var(--paper)]` background
```

### 13.4 `notificationSlice` — `apps/web/src/features/notifications/notificationSlice.ts`
```ts
interface NotificationState {
  items: NotificationRecord[];
  unreadCount: number;
  isConnected: boolean;
}
// Actions: setNotifications, addNotification, markRead, setConnected
```

### 13.5 Wire `useSSE` into `AppLayout` — `apps/web/src/components/layout/AppLayout.tsx`
```tsx
// Add to AppLayout (already exists):
const { orgId } = useParams();
useSSE(orgId!);  // Start SSE connection for the org session
// Add <NotificationBell /> to header
```

---

## Frontend Files to Create

```
apps/web/src/hooks/useSSE.ts
apps/web/src/lib/sseInvalidations.ts
apps/web/src/features/notifications/notificationSlice.ts
apps/web/src/features/notifications/notificationTypes.ts
apps/web/src/api/notificationApi.ts
apps/web/src/components/notifications/NotificationBell.tsx
apps/web/src/components/notifications/NotificationItem.tsx
```

Files to update:
```
apps/web/src/components/layout/AppLayout.tsx   (add useSSE + NotificationBell)
apps/web/src/app/store.ts                      (add notificationSlice reducer)
```

---

## Implementation Notes

### EventSource vs WebSocket
The server uses **SSE (Server-Sent Events)** — not WebSocket. Use `new EventSource(url, { withCredentials: true })`. SSE is one-way server→client only, which is correct here.

### Auth in dev bypass mode
In `VITE_DEV_BYPASS=true` mode, the SSE stream will still attempt to connect to the real server. Since there's no real server in dev, the connection will fail silently. The `useSSE` hook should handle `error` events gracefully without crashing.

Option: In bypass mode, skip SSE entirely: `if (bypass) return;`

### Notification message text generation
The frontend must derive human-readable text from `eventType` + `payload`:
```ts
function formatNotification(n: NotificationRecord): string {
  switch (n.eventType) {
    case 'RfiOverdue': return `RFI "${n.payload.subject}" is overdue (was due ${n.payload.dueDate})`;
    case 'DocumentExpiring': return `Document "${n.payload.name}" expires on ${n.payload.expirationDate}`;
    case 'procurement.purchase_order.approved': return `Purchase order was approved`;
    // ...
  }
}
```

### Navigation on notification click
```ts
function getNotificationUrl(n: NotificationRecord): string | null {
  switch (n.eventType) {
    case 'RfiOverdue': return `/org/${n.organizationId}/projects/${n.projectId}/rfis/${n.payload.rfiId}`;
    case 'DocumentExpiring': return `/org/${n.organizationId}/projects/${n.projectId}/documents/${n.payload.documentId}`;
    case 'procurement.purchase_order.approved': return `/org/${n.organizationId}/projects/${n.projectId}/procurement/orders/${n.payload.poId}`;
    // ...
  }
}
```

### SSE CORS / cookie
The `EventSource` with `{ withCredentials: true }` sends the session cookie. The Fastify server must have CORS configured to allow this from the web origin. Verify `credentials: true` in the server CORS config before integrating.

### Reconnection strategy
`EventSource` has built-in reconnection (exponential backoff). No manual retry logic needed. The server sends `retry: 3000` to configure the reconnect interval.
