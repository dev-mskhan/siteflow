// apps/server/tests/helpers/fixtures.ts
// Shared test fixture helpers used across all integration test suites.

import { getDb } from '../../src/lib/db/index.js';
import {
  users,
  roles,
  organizationMemberships,
  outboxEvents,
} from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { FastifyInstance } from 'fastify';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';

/**
 * Creates a verified user directly in DB, returns user + Bearer token.
 * The password hash corresponds to "password123".
 */
export async function createVerifiedUser(overrides?: {
  email?: string;
  firstName?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
}) {
  const db = getDb();
  const email =
    overrides?.email ?? `user_${crypto.randomUUID().slice(0, 8)}@test.dev`;
  const inserted = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      email,
      // bcrypt hash of "password123", cost factor 10
      passwordHash:
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVDVqo/DK2',
      firstName: overrides?.firstName ?? 'Test',
      status: overrides?.status ?? 'ACTIVE',
      emailVerifiedAt: new Date(),
    })
    .returning();
  const user = inserted[0]!;
  const token = createAccessToken({
    sub: user.id,
    email: user.email,
    status: user.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  });
  return { user, token };
}

/**
 * Creates a user WITHOUT email verification.
 * Token is still generated so the user can attempt authenticated requests.
 */
export async function createUnverifiedUser(email?: string) {
  const db = getDb();
  const userEmail =
    email ?? `unverified_${crypto.randomUUID().slice(0, 8)}@test.dev`;
  const inserted = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      email: userEmail,
      passwordHash:
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVDVqo/DK2',
      firstName: 'Unverified',
      status: 'ACTIVE',
      emailVerifiedAt: null,
    })
    .returning();
  const user = inserted[0]!;
  const token = createAccessToken({
    sub: user.id,
    email: user.email,
    status: 'ACTIVE',
  });
  return { user, token };
}

/**
 * Creates an org via API, returns orgId + all role IDs (as a Map<name, id>) + admin membership ID.
 * Requires a verified-user token with at least 1 org slot remaining.
 */
export async function createOrgWithAdmin(
  app: FastifyInstance,
  adminToken: string,
  name?: string,
) {
  const db = getDb();
  const orgName = name ?? `Org ${crypto.randomUUID().slice(0, 8)}`;
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/organizations',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: orgName },
  });
  if (res.statusCode !== 201) {
    throw new Error(
      `createOrgWithAdmin failed: ${res.statusCode} ${res.body}`,
    );
  }
  const orgId = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data
    .organization.id;

  const orgRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.organizationId, orgId));
  const roleMap = new Map(orgRoles.map((r) => [r.name, r.id]));

  const memberships = await db
    .select()
    .from(organizationMemberships)
    .where(eq(organizationMemberships.organizationId, orgId));
  const adminMembershipId = memberships[0]!.id;

  return { orgId, roleMap, adminMembershipId };
}

/**
 * Adds a user as a member of an org with a specific role via direct DB insert.
 * Used to set up lower-privilege members without going through the invitation flow.
 */
export async function addMemberDirectly(
  orgId: string,
  userId: string,
  roleId: string,
) {
  const db = getDb();
  const inserted = await db
    .insert(organizationMemberships)
    .values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId,
      roleId,
      status: 'ACTIVE',
      joinedAt: new Date(),
    })
    .returning();
  return inserted[0]!;
}

/**
 * Logs in via the API, returns the raw signed access_token cookie value
 * and the raw refresh_token cookie value for use in subsequent cookie-auth requests.
 */
export async function loginAndGetCookies(
  app: FastifyInstance,
  email: string,
  password: string,
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(
      `loginAndGetCookies failed: ${res.statusCode} ${res.body}`,
    );
  }

  const setCookieHeaders = res.headers['set-cookie'];
  const cookieArr = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders ?? ''];

  const extractCookie = (name: string) => {
    const entry = cookieArr.find((c) => c.startsWith(`${name}=`));
    if (!entry) return '';
    return decodeURIComponent(
      entry.split(';')[0]!.slice(name.length + 1),
    );
  };

  return {
    accessCookie: extractCookie('access_token'),
    refreshCookie: extractCookie('refresh_token'),
    userId: res.json().data.user.id as string,
  };
}

/**
 * Extracts the raw invitation token from the outbox_events table.
 * Mirrors what the invitation worker would have sent via email.
 */
export async function getInvitationTokenFromOutbox(
  inviteeEmail: string,
): Promise<string> {
  const db = getDb();
  const events = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.eventType, 'org:send-invitation-email'));
  const evt = events.find((e) => (e.payload as any).email === inviteeEmail);
  if (!evt) {
    throw new Error(
      `No invitation outbox event found for ${inviteeEmail}`,
    );
  }
  return (evt.payload as any).token as string;
}

/**
 * Extracts the raw email verification token from the outbox_events table.
 * Uses the most recently written event for the given email (reverse search).
 */
export async function getEmailVerificationTokenFromOutbox(
  userEmail: string,
): Promise<string> {
  const db = getDb();
  const events = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.eventType, 'auth:send-email-verification'));
  const evt = [...events]
    .reverse()
    .find((e) => (e.payload as any).email === userEmail);
  if (!evt) {
    throw new Error(
      `No email verification outbox event found for ${userEmail}`,
    );
  }
  return (evt.payload as any).token as string;
}

/**
 * Extracts the raw password reset token from the outbox_events table.
 * Uses the most recently written event for the given email (reverse search).
 */
export async function getPasswordResetTokenFromOutbox(
  userEmail: string,
): Promise<string> {
  const db = getDb();
  const events = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.eventType, 'auth:send-password-reset'));
  const evt = [...events]
    .reverse()
    .find((e) => (e.payload as any).email === userEmail);
  if (!evt) {
    throw new Error(
      `No password reset outbox event found for ${userEmail}`,
    );
  }
  return (evt.payload as any).token as string;
}

/**
 * Counts outbox events of a specific type, optionally filtering by payload fields.
 */
export async function countOutboxEvents(
  eventType: string,
  matchPayload?: Record<string, string>,
): Promise<number> {
  const db = getDb();
  const events = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.eventType, eventType));
  if (!matchPayload) return events.length;
  return events.filter((e) => {
    const p = e.payload as Record<string, string>;
    return Object.entries(matchPayload).every(([k, v]) => p[k] === v);
  }).length;
}
