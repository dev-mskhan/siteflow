/**
 * notificationApi — Live integration with backend notification system.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Backend: apps/server/src/modules/notification/notification.routes.ts
 *   GET    /api/v1/organizations/:orgId/notifications
 *   GET    /api/v1/organizations/:orgId/notifications/unread-count
 *   PATCH  /api/v1/organizations/:orgId/notifications/:notificationId/read
 *   POST   /api/v1/organizations/:orgId/notifications/read-all
 *   GET    /api/v1/organizations/:orgId/notifications/preferences
 *   PUT    /api/v1/organizations/:orgId/notifications/preferences
 *
 * SSE Endpoint (handled separately via EventSource):
 *   GET /api/v1/organizations/:orgId/notifications/stream
 */
import { baseApi } from '../../services/baseApi';

export interface NotificationRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  recipientId: string;
  eventId: string | null;
  eventType: string;
  channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP';
  templateId: string | null;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  readAt: string | null;
  retryCount: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  eventType: string;
  channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP';
  enabled: boolean;
}

interface OrgArgs {
  orgId: string;
}

interface ListNotificationsArgs extends OrgArgs {
  limit?: number;
}

interface MarkReadArgs extends OrgArgs {
  notificationId: string;
}

interface UpdatePreferenceArgs extends OrgArgs {
  eventType: string;
  channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP';
  enabled: boolean;
}

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ────────────────────────────────────────────────────────────────────────
    // Notification List
    // ────────────────────────────────────────────────────────────────────────

    listNotifications: build.query<
      { notifications: NotificationRecord[] },
      ListNotificationsArgs
    >({
      query: ({ orgId, limit = 50 }) => ({
        url: `/api/v1/organizations/${orgId}/notifications`,
        params: { limit },
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { notifications: NotificationRecord[] } }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: orgId }],
    }),

    // ────────────────────────────────────────────────────────────────────────
    // Unread Count
    // ────────────────────────────────────────────────────────────────────────

    getUnreadCount: build.query<{ unreadCount: number }, OrgArgs>({
      query: ({ orgId }) => ({
        url: `/api/v1/organizations/${orgId}/notifications/unread-count`,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { unreadCount: number } }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: `count_${orgId}` }],
    }),

    // ────────────────────────────────────────────────────────────────────────
    // Mark Single Read
    // ────────────────────────────────────────────────────────────────────────

    markNotificationRead: build.mutation<
      { notification: NotificationRecord },
      MarkReadArgs
    >({
      query: ({ orgId, notificationId }) => ({
        url: `/api/v1/organizations/${orgId}/notifications/${notificationId}/read`,
        method: 'PATCH',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { notification: NotificationRecord } }) => raw.data,
      invalidatesTags: (_r, _e, { orgId, notificationId }) => [
        { type: 'Notification', id: orgId },
        { type: 'Notification', id: notificationId },
        { type: 'Notification', id: `count_${orgId}` },
      ],
    }),

    // ────────────────────────────────────────────────────────────────────────
    // Mark All Read
    // ────────────────────────────────────────────────────────────────────────

    markAllNotificationsRead: build.mutation<{ markedCount: number }, OrgArgs>({
      query: ({ orgId }) => ({
        url: `/api/v1/organizations/${orgId}/notifications/read-all`,
        method: 'POST',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { markedCount: number } }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [
        { type: 'Notification', id: orgId },
        { type: 'Notification', id: `count_${orgId}` },
      ],
    }),

    // ────────────────────────────────────────────────────────────────────────
    // Preferences
    // ────────────────────────────────────────────────────────────────────────

    getNotificationPreferences: build.query<
      { preferences: NotificationPreference[] },
      OrgArgs
    >({
      query: ({ orgId }) => ({
        url: `/api/v1/organizations/${orgId}/notifications/preferences`,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { preferences: NotificationPreference[] } }) => raw.data,
      providesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: `prefs_${orgId}` }],
    }),

    updateNotificationPreference: build.mutation<
      { preference: NotificationPreference },
      UpdatePreferenceArgs
    >({
      query: ({ orgId, eventType, channel, enabled }) => ({
        url: `/api/v1/organizations/${orgId}/notifications/preferences`,
        method: 'PUT',
        body: { eventType, channel, enabled },
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { preference: NotificationPreference } }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: `prefs_${orgId}` }],
    }),

  }),
});

export const {
  useListNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} = notificationApi;

