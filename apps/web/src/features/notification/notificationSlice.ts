/**
 * notificationSlice — Redux slice for SSE/realtime connection state.
 *
 * Tracks:
 *   - connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected'
 *   - lastEventAt: ISO timestamp of the most recent SSE event received
 *   - recentEventIds: Set of event IDs seen in the last 5 minutes (dedup)
 *   - lastToastAt: ISO timestamp of the last toast shown (throttle toasts)
 *
 * This is NOT the notification data itself — that lives in RTK Query cache
 * (notificationApi). This slice is purely for connection lifecycle + dedup.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SSEConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface SSEEventPayload {
  type: string;
  organizationId?: string;
  projectId?: string;
  [key: string]: unknown;
}

interface NotificationState {
  connectionStatus: SSEConnectionStatus;
  lastEventAt: string | null;
  recentEventIds: string[];
  lastToastAt: string | null;
}

const initialState: NotificationState = {
  connectionStatus: 'idle',
  lastEventAt: null,
  recentEventIds: [],
  lastToastAt: null,
};

const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RECENT_IDS = 100;
const TOAST_THROTTLE_MS = 3000; // Don't toast more than once per 3s

export const notificationSlice = createSlice({
  name: 'sseNotification',
  initialState,
  reducers: {
    connectionStatusChanged(state, action: PayloadAction<SSEConnectionStatus>) {
      state.connectionStatus = action.payload;
    },

    sseEventReceived(state, action: PayloadAction<SSEEventPayload>) {
      const now = Date.now();
      const event = action.payload;

      // Generate a dedup key from the event payload
      // Use combination of type + any ID fields present
      const dedupKey = [
        event.type,
        event.rfiId,
        event.submittalId,
        event.subscriptionId,
        event.projectId,
        event.outboxEventId,
        (event as Record<string, unknown>).id,
      ].filter(Boolean).join(':');

      // Prune old entries outside the dedup window
      const cutoff = now - DEDUP_WINDOW_MS;
      state.recentEventIds = state.recentEventIds.filter((entry) => {
        const ts = parseInt(entry.split('|')[1] ?? '0', 10);
        return ts > cutoff;
      });

      // Check for duplicate
      const fullKey = `${dedupKey}|${now}`;
      // If we've seen this event type+id combo recently, mark as duplicate
      const isDuplicate = state.recentEventIds.some(
        (entry) => entry.split('|')[0] === dedupKey,
      );

      if (!isDuplicate) {
        state.recentEventIds.push(fullKey);
        if (state.recentEventIds.length > MAX_RECENT_IDS) {
          state.recentEventIds = state.recentEventIds.slice(-MAX_RECENT_IDS);
        }
      }

      // Always update lastEventAt (even duplicates mean the connection is alive)
      state.lastEventAt = new Date(now).toISOString();

      // Throttle toasts — only allow one toast per TOAST_THROTTLE_MS
      const lastToast = state.lastToastAt ? new Date(state.lastToastAt).getTime() : 0;
      if (now - lastToast >= TOAST_THROTTLE_MS && !isDuplicate) {
        state.lastToastAt = new Date(now).toISOString();
      }
    },

    resetSSEState(state) {
      state.connectionStatus = 'idle';
      state.lastEventAt = null;
      state.recentEventIds = [];
      state.lastToastAt = null;
    },
  },
});

export const {
  connectionStatusChanged,
  sseEventReceived,
  resetSSEState,
} = notificationSlice.actions;

export const notificationReducer = notificationSlice.reducer;

// ── Event type → RTK Query tag mapping ─────────────────────────────────────
// Maps server event types to the RTK Query cache tags that should be invalidated.
// This is the industry-standard approach: selective invalidation based on
// the event's domain, rather than a blanket invalidation of all caches.

import type { NotificationTag } from './tagTypes';

export type { NotificationTag };

export function getTagsForEvent(
  event: SSEEventPayload,
  orgId: string,
): NotificationTag[] {
  const tags: NotificationTag[] = [
    { type: 'Notification', id: orgId },
    { type: 'Notification', id: `count_${orgId}` },
  ];

  const type = event.type;
  const projectId = event.projectId;

  // RFI events → invalidate RFI cache
  if (type.startsWith('rfi.')) {
    tags.push({ type: 'RFI' as const, id: projectId ?? 'LIST' });
    // Also invalidate the specific RFI if we have an ID
    if (event.rfiId) {
      tags.push({ type: 'RFI' as const, id: event.rfiId as string });
    }
  }

  // Submittal events → invalidate Submittal cache
  if (type.startsWith('submittal.')) {
    tags.push({ type: 'Submittal' as const, id: projectId ?? 'LIST' });
    if (event.submittalId) {
      tags.push({ type: 'Submittal' as const, id: event.submittalId as string });
    }
  }

  // Billing events → invalidate billing caches
  if (type.startsWith('billing.')) {
    tags.push({ type: 'Trial' as const, id: 'TRIAL' });
    tags.push({ type: 'Invoice' as const, id: 'INVOICES' });
  }

  // Platform lifecycle events → invalidate org caches
  if (type.startsWith('platform.')) {
    tags.push({ type: 'PlatformOrg' as const, id: 'LIST' });
  }

  // Document expiry → invalidate document cache
  if (type === 'DocumentExpiring') {
    tags.push({ type: 'Document' as const, id: projectId ?? 'LIST' });
  }

  // Procurement events → invalidate procurement caches
  if (type.startsWith('procurement.')) {
    tags.push({ type: 'PO' as const, id: 'LIST' });
    tags.push({ type: 'MR' as const, id: 'LIST' });
  }

  // Project task events → invalidate task cache
  if (type.startsWith('project.task.')) {
    tags.push({ type: 'Task' as const, id: projectId ?? 'LIST' });
  }

  // Change order events → invalidate commercial cache
  if (type.startsWith('project.change_order.')) {
    tags.push({ type: 'ChangeOrder' as const, id: projectId ?? 'LIST' });
  }

  // Safety events → invalidate safety cache
  if (type.startsWith('safety.')) {
    tags.push({ type: 'SafetyEvent' as const, id: projectId ?? 'LIST' });
  }

  return tags;
}

// ── Toast message mapping ──────────────────────────────────────────────────
export function getToastForEvent(event: SSEEventPayload): { title: string; message: string } | null {
  const map: Record<string, { title: string; message: string }> = {
    'rfi.submitted':           { title: 'New RFI submitted',       message: 'A new RFI has been submitted for review.' },
    'rfi.responded':            { title: 'RFI response received',   message: 'An RFI has received a response.' },
    'rfi.closed':               { title: 'RFI closed',              message: 'An RFI has been closed.' },
    'submittal.submitted':      { title: 'Submittal submitted',     message: 'A new submittal has been submitted.' },
    'submittal.reviewed':       { title: 'Submittal reviewed',      message: 'A submittal has been reviewed.' },
    'submittal.closed':         { title: 'Submittal closed',        message: 'A submittal has been closed.' },
    'platform.organization.suspended':   { title: 'Organization suspended',   message: 'Your organization has been suspended.' },
    'platform.organization.reactivated':  { title: 'Organization reactivated', message: 'Your organization has been reactivated.' },
    'billing.subscription.status_changed': { title: 'Subscription updated',     message: 'Your subscription status has changed.' },
    'billing.grace.started':              { title: 'Billing grace period',      message: 'Your subscription entered its grace period.' },
    'billing.grace.ended':                { title: 'Grace period ended',        message: 'Your billing grace period has ended.' },
    'billing.entitlement.changed':        { title: 'Entitlements changed',      message: 'Your subscription entitlements have changed.' },
  };

  return map[event.type] ?? null;
}
