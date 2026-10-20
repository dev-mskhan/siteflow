/**
 * notificationApi — Group 13 RTK Query slice.
 * Backend: apps/server/src/modules/notification/notification.routes.ts
 *   GET    /api/v1/organizations/:orgId/notifications?limit=50
 *   GET    /api/v1/organizations/:orgId/notifications/unread-count
 *   PATCH  /api/v1/organizations/:orgId/notifications/:notificationId/read
 *   POST   /api/v1/organizations/:orgId/notifications/read-all
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type { NotificationRecord } from '../types/reportTypes';

const delay = (ms = 100) => new Promise<void>((r) => setTimeout(r, ms));

// In-memory mock store
const MOCK_NOTIFICATIONS: NotificationRecord[] = [
  { id: 'notif_01', organizationId: 'org_01', projectId: 'proj_01', recipientId: 'usr_01', eventId: 'evt_01', eventType: 'RfiOverdue', channel: 'IN_APP', templateId: null, payload: { rfiId: 'rfi_02', subject: 'Slab reinforcement at stairwell opening', dueDate: '2024-05-15' }, status: 'DELIVERED', readAt: null, retryCount: 0, lastError: null, deliveredAt: new Date(Date.now() - 2 * 3600000).toISOString(), createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), updatedAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'notif_02', organizationId: 'org_01', projectId: 'proj_01', recipientId: 'usr_01', eventId: 'evt_02', eventType: 'DocumentExpiring', channel: 'IN_APP', templateId: null, payload: { documentId: 'doc_02', name: 'Building Permit 2024-B-041', expirationDate: '2025-06-30' }, status: 'DELIVERED', readAt: null, retryCount: 0, lastError: null, deliveredAt: new Date(Date.now() - 5 * 3600000).toISOString(), createdAt: new Date(Date.now() - 5 * 3600000).toISOString(), updatedAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: 'notif_03', organizationId: 'org_01', projectId: 'proj_01', recipientId: 'usr_01', eventId: 'evt_03', eventType: 'procurement.purchase_order.approved', channel: 'IN_APP', templateId: null, payload: { organizationId: 'org_01', projectId: 'proj_01', poId: 'po_01' }, status: 'DELIVERED', readAt: new Date(Date.now() - 86400000).toISOString(), retryCount: 0, lastError: null, deliveredAt: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
];

export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Notification'],
  endpoints: (build) => ({

    listNotifications: build.query<{ notifications: NotificationRecord[] }, { orgId: string; limit?: number }>({
      queryFn: async ({ orgId }) => {
        await delay();
        const notifs = MOCK_NOTIFICATIONS.filter((n) => n.organizationId === orgId);
        return { data: { notifications: notifs } };
      },
      providesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: orgId }],
    }),

    getUnreadCount: build.query<{ unreadCount: number }, { orgId: string }>({
      queryFn: async ({ orgId }) => {
        await delay(80);
        const count = MOCK_NOTIFICATIONS.filter((n) => n.organizationId === orgId && n.readAt === null).length;
        return { data: { unreadCount: count } };
      },
      providesTags: (_r, _e, { orgId }) => [{ type: 'Notification', id: `count_${orgId}` }],
    }),

    markNotificationRead: build.mutation<{ notification: NotificationRecord }, { orgId: string; notificationId: string }>({
      queryFn: async ({ notificationId }) => {
        await delay(100);
        const idx = MOCK_NOTIFICATIONS.findIndex((n) => n.id === notificationId);
        if (idx === -1) return { error: { status: 404, error: 'NOT_FOUND' } };
        const now = new Date().toISOString();
        MOCK_NOTIFICATIONS[idx] = { ...MOCK_NOTIFICATIONS[idx]!, readAt: now, updatedAt: now };
        return { data: { notification: MOCK_NOTIFICATIONS[idx]! } };
      },
      invalidatesTags: (_r, _e, { orgId }) => [
        { type: 'Notification', id: orgId },
        { type: 'Notification', id: `count_${orgId}` },
      ],
    }),

    markAllRead: build.mutation<{ markedCount: number }, { orgId: string }>({
      queryFn: async ({ orgId }) => {
        await delay(150);
        const now = new Date().toISOString();
        let count = 0;
        MOCK_NOTIFICATIONS.forEach((n, i) => {
          if (n.organizationId === orgId && n.readAt === null) {
            MOCK_NOTIFICATIONS[i] = { ...n, readAt: now, updatedAt: now };
            count++;
          }
        });
        return { data: { markedCount: count } };
      },
      invalidatesTags: (_r, _e, { orgId }) => [
        { type: 'Notification', id: orgId },
        { type: 'Notification', id: `count_${orgId}` },
      ],
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllReadMutation,
} = notificationApi;
