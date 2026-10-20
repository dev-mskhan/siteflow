/**
 * platformTypes — Platform admin console DTOs.
 * Source: apps/server/src/modules/platform/
 *
 * Key rules:
 *   - All writes require password re-entry + reasonCode + reasonNote (min 10 chars)
 *   - Reason codes: SECURITY_INCIDENT | FRAUD | POLICY_VIOLATION | CUSTOMER_REQUEST | OTHER
 *   - Org suspension needs two operators (requester ≠ approver)
 *   - Support grant scopes: read:org_summary | read:org_subscription | read:org_entitlements
 *   - Support grant max duration: 1440 minutes (24h)
 *   - Emails are masked in all responses
 *   - Idempotency keys supported on all writes
 */

export type LifecycleReasonCode =
  | 'SECURITY_INCIDENT' | 'FRAUD' | 'POLICY_VIOLATION' | 'CUSTOMER_REQUEST' | 'OTHER';

export type SupportGrantScope =
  | 'read:org_summary' | 'read:org_subscription' | 'read:org_entitlements';

export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

// ── Organization listing ──────────────────────────────────────────────────────
export interface PlatformOrgRow {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  createdAt: string;
  memberCount: number;
  ownerUserId: string | null;
  ownerEmailMasked: string | null;
}

// ── Account listing ──────────────────────────────────────────────────────────
export interface PlatformAccountRow {
  id: string;
  emailMasked: string;
  firstName: string;
  lastName: string | null;
  status: AccountStatus;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  membershipCount: number;
}

// ── Lifecycle input ──────────────────────────────────────────────────────────
export interface LifecycleInput {
  password: string;           // re-authentication, min 1 max 256
  reasonCode: LifecycleReasonCode;
  reasonNote: string;         // min 10 max 500
}

// ── Billing ──────────────────────────────────────────────────────────────────
export interface OrganizationBillingView {
  organizationId: string;
  subscription: {
    subscriptionId: string;
    status: string;
    planName: string | null;
    graceStartsAt: string | null;
    amountCents: number | null;
    currency: string | null;
  } | null;
  invoices: Array<{
    id: string;
    status: string;
    amountDueCents: number;
    currency: string;
    createdAt: string;
    paymentAttemptCount: number;
  }>;
}

export interface WebhookInboxSummary {
  counts: Record<'PENDING' | 'RETRY' | 'PROCESSING' | 'FAILED' | 'QUARANTINED', number>;
}

// ── Diagnostics ───────────────────────────────────────────────────────────────
export interface HealthView {
  status: 'ok' | 'degraded';
  database: { ok: boolean; latencyMs: number };
  checkedAt: string;
}

export interface QueueDiagnosticsView {
  windowHours: number;
  counts: Record<string, number>;
  oldestWaitingJobAgeSeconds: number | null;
  webhookInbox: WebhookInboxSummary['counts'];
  outbox: {
    failedCount: number;
    oldestFailedAt: string | null;
    failed: Array<{
      id: string;
      eventType: string;
      organizationId: string | null;
      retryCount: number;
      createdAt: string;
    }>;
  };
}

export interface OrganizationDiagnosticsView {
  organizationId: string;
  notificationDeliveries: Record<string, number>;
  storageBytes: number;
}

// ── Support Grants ───────────────────────────────────────────────────────────
export interface SupportGrantRequestInput extends LifecycleInput {
  operatorUserId: string;
  organizationId: string;
  scopes: SupportGrantScope[];
}

export interface SupportGrantApproveInput {
  password: string;
  durationMinutes: number;  // 1-1440
}

export interface SupportGrantRevokeInput {
  password: string;
}
