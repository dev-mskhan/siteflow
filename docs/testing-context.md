# SiteFlow Testing Context

This document provides comprehensive context for writing and understanding integration tests in the SiteFlow server application.

---

## 1. Project Overview

**SiteFlow** is a multi-tenant SaaS construction management platform. **Phase 1** covers:

- User authentication (registration, login, sessions, email verification, password reset)
- Organization lifecycle (creation, update, profile, settings, document sequences)
- Role-Based Access Control (RBAC) with 7 system roles per organization
- Member management (list, get, update, soft-delete/remove)
- Invitation flow (create, list, cancel, accept) with outbox-based email delivery
- Audit logging for all mutations

Every organization is a completely isolated tenant. Data from Org A is never visible to members of Org B.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript (ESM, `.js` extension imports) |
| HTTP framework | Fastify 5 |
| Database | PostgreSQL (schema: `app`) |
| ORM | Drizzle ORM |
| Cache | Redis (ioredis) |
| Background jobs | PgBoss (queue worker) + Outbox pattern |
| Validation | Zod (schemas in `@siteflow/shared`) |
| Testing | Vitest |
| Monorepo | Turborepo |

---

## 3. Architecture

### Auth: Dual-token, dual-transport

- **Access Token**: signed JWT (`RS256` or `HS256` via `JWT_SECRET`) — short-lived (`JWT_EXPIRY`, default 15 min)
- **Refresh Token**: 64-char hex (SHA-256 stored in DB) — long-lived (`REFRESH_TOKEN_EXPIRY_DAYS`)
- Both tokens are delivered in **signed httpOnly cookies** (`@fastify/cookie` with `COOKIE_SECRET`)
- The `authenticate` middleware accepts:
  1. Signed `access_token` cookie (auto-unsigned → JWT payload)
  2. `Authorization: Bearer <jwt>` header
- No auth header AND no cookie → `401 UNAUTHORIZED`

Cookie names:
- `access_token` — signed, httpOnly, `sameSite: lax`, `path: /`, `maxAge: 15min`
- `refresh_token` — signed, httpOnly, `sameSite: lax`, `path: /`

After login/register, the response sets **both** cookies. For refresh, both are re-issued.

### organizationContext middleware

Runs after `authenticate` on all org-scoped routes. Reads `organizationId` (or `id`) from `request.params`, validates UUID format (422 if non-UUID), then calls `rbacService.getOrganizationContext()` which:

1. Queries `organization_memberships` for user+org with status `ACTIVE`
2. Resolves the role's permissions (Redis cache first, fallback to DB)
3. Sets `request.orgContext: OrganizationContext`

If user has no active membership → **403 FORBIDDEN**.

### requirePermission middleware

Checks `request.orgContext.permissions` for a required permission key. On failure: logs `permission.denied` audit entry and throws **403 FORBIDDEN**.

---

## 4. All Routes

### Health

| Method | Path | Auth | Permission |
|--------|------|------|-----------|
| GET | `/health` | None | — |
| GET | `/health/ready` | None | — |

### Auth (`/api/v1/auth`)

| Method | Path | Auth | Permission |
|--------|------|------|-----------|
| POST | `/register` | None | — |
| POST | `/login` | None | — |
| GET | `/google` | None | — |
| GET | `/google/callback` | None | — |
| POST | `/refresh` | None (refresh_token cookie) | — |
| POST | `/verify-email` | None | — |
| POST | `/resend-verification` | None | — |
| POST | `/forgot-password` | None | — |
| POST | `/reset-password` | None | — |
| POST | `/logout` | Bearer/Cookie | — |
| POST | `/change-password` | Bearer/Cookie | — |
| GET | `/me` | Bearer/Cookie | — |
| GET | `/sessions` | Bearer/Cookie | — |
| DELETE | `/sessions/:sessionId` | Bearer/Cookie | — |
| POST | `/logout-all` | Bearer/Cookie | — |

### Organizations (`/api/v1/organizations`)

| Method | Path | Auth | Permission |
|--------|------|------|-----------|
| POST | `/` | Bearer/Cookie | email verified |
| GET | `/` | Bearer/Cookie | — |
| GET | `/:organizationId` | Bearer/Cookie | organizationContext |
| PATCH | `/:organizationId` | Bearer/Cookie | `organization:update` |
| GET | `/:organizationId/profile` | Bearer/Cookie | `organization:read` |
| PATCH | `/:organizationId/profile` | Bearer/Cookie | `organization:update` |
| GET | `/:organizationId/settings` | Bearer/Cookie | `settings:read` |
| PATCH | `/:organizationId/settings` | Bearer/Cookie | `settings:update` |
| GET | `/:organizationId/document-sequences` | Bearer/Cookie | `settings:read` |
| GET | `/:organizationId/document-sequences/:type` | Bearer/Cookie | `settings:read` |
| PATCH | `/:organizationId/document-sequences/:type` | Bearer/Cookie | `settings:update` |

### Members (`/api/v1/organizations`)

| Method | Path | Auth | Permission |
|--------|------|------|-----------|
| GET | `/:organizationId/members` | Bearer/Cookie | `member:read` |
| GET | `/:organizationId/members/:memberId` | Bearer/Cookie | `member:read` |
| PATCH | `/:organizationId/members/:memberId` | Bearer/Cookie | `member:update` |
| DELETE | `/:organizationId/members/:memberId` | Bearer/Cookie | `member:remove` |

### Invitations

| Method | Path | Auth | Permission |
|--------|------|------|-----------|
| POST | `/api/v1/organizations/:organizationId/invitations` | Bearer/Cookie | `member:invite` |
| GET | `/api/v1/organizations/:organizationId/invitations` | Bearer/Cookie | `member:read` |
| DELETE | `/api/v1/organizations/:organizationId/invitations/:id` | Bearer/Cookie | `invitation:cancel` |
| POST | `/api/v1/invitations/:token/accept` | Bearer/Cookie | — |

### Audit

| Method | Path | Auth | Permission |
|--------|------|------|-----------|
| GET | `/api/v1/organizations/:organizationId/audit` | Bearer/Cookie | `audit:read` |

---

## 5. RBAC Matrix — 7 System Roles × Permissions

| Permission | Org Admin | Project Manager | Finance | Procurement | Site Supervisor | Subcontractor | Client |
|-----------|-----------|----------------|---------|-------------|----------------|---------------|--------|
| `organization:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `organization:update` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `member:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `member:invite` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `member:update` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `member:remove` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `invitation:cancel` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings:read` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings:update` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit:read` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `project:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `project:update` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `task:create` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `task:update` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `task:update:own` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `document:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `document:upload` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `payment:approve` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `change_order:approve` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## 6. Response Envelope Shapes

### Success

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-01T00:00:00.000Z",
    "requestId": "uuid"
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [...],
    "requestId": "uuid"
  }
}
```

TypeScript types: `ApiSuccessResponse<T>` and `ApiErrorResponse` from `../../src/shared/response.js`.

---

## 7. Status Code Reference

| Code | Constant | When |
|------|----------|------|
| 200 | OK | Successful GET / PATCH / DELETE / POST (some) |
| 201 | Created | POST (resource created) |
| 400 | BAD_REQUEST | Generic bad request (rare) |
| 401 | UNAUTHORIZED | No/invalid/expired auth token |
| 403 | FORBIDDEN | Not a member, missing permission, suspended account, unverified email |
| 404 | NOT_FOUND | Resource doesn't exist (scoped to tenant) |
| 409 | CONFLICT | Duplicate resource (email, slug, invitation) |
| 422 | VALIDATION_ERROR | Zod schema fail, FST_ERR_VALIDATION, non-UUID org ID, business-logic validation errors |
| 429 | TOO_MANY_REQUESTS | 5 failed login attempts per email:ip within 15 min |
| 500 | INTERNAL_SERVER_ERROR | Unhandled exceptions |

**Key facts:**
- Non-UUID `organizationId` in params → **422** (organizationContext UUID regex check)
- Non-UUID `sessionId` in params → **422** (sessionIdParamSchema in `@siteflow/shared`)
- Zod validation failure → **422** (both direct parse and FST_ERR_VALIDATION)
- `updateSettingsSchema` is NOT strict — unknown fields silently dropped
- `updateSequenceSchema` is NOT strict — `nextValue` silently dropped
- `InvitationDTO` has NO `token`/`tokenHash` field — token only in outbox payload
- `OrgDTO` fields: `id, name, slug, status, createdBy, createdAt, updatedAt` — NO country, NO settings
- After `changePassword` or `resetPassword`: ALL sessions revoked, cookies cleared
- After `logout`: current session revoked
- Membership soft-delete: status set to `REMOVED`, record stays in DB
- Rate limiting: 5 wrong login attempts per `email:ip` → 429 `TOO_MANY_REQUESTS`
- Org cap: max 5 orgs per user → **403** on 6th attempt
- Email normalized: `.trim().toLowerCase()` before DB ops

---

## 8. Database Tables Overview

All tables live in the `app` PostgreSQL schema.

| Table | Key Columns |
|-------|------------|
| `users` | `id, email (unique lower), passwordHash, firstName, lastName, status, emailVerifiedAt, lastLoginAt` |
| `sessions` | `id, userId, refreshTokenHash, expiresAt, revokedAt, ipAddress, userAgent` |
| `email_verification_tokens` | `id, userId, tokenHash, expiresAt, usedAt` |
| `password_reset_tokens` | `id, userId, tokenHash, expiresAt, usedAt` |
| `oauth_accounts` | `id, userId, provider, providerAccountId` |
| `organizations` | `id, name, slug (unique), status, createdBy` |
| `organization_profiles` | `organizationId (PK), legalName, businessName, businessType, primaryEmail, website, country (ISO-3166 alpha-2), ...` |
| `organization_settings` | `organizationId (PK), timezone, currency (3-char), locale, dateFormat, timeFormat, unitSystem, weekStartsOn (0-6), fiscalYearStartMonth (1-12)` |
| `document_sequences` | `id, organizationId, type (enum), prefix, padding (1-10), nextValue (>=1)` |
| `roles` | `id, organizationId, name (unique per org), isSystem` |
| `permissions` | `id, key (unique)` |
| `role_permissions` | `roleId, permissionId` |
| `organization_memberships` | `id, organizationId, userId (unique per org), roleId, status (ACTIVE/SUSPENDED/REMOVED), joinedAt` |
| `invitations` | `id, organizationId, email, roleId, tokenHash, status (PENDING/ACCEPTED/EXPIRED/CANCELLED), expiresAt, acceptedAt, invitedBy` |
| `audit_logs` | `id, organizationId, actorUserId, action, resourceType, resourceId, metadata, ipAddress, userAgent` |
| `outbox_events` | `id, organizationId, eventType, payload, status (PENDING/PROCESSED/FAILED), retryCount` |

### Default Document Sequences (seeded on org creation)

| Type | Prefix | Padding |
|------|--------|---------|
| PROJECT | PRJ | 4 |
| ESTIMATE | EST | 4 |
| INVOICE | INV | 4 |
| PURCHASE_ORDER | PO | 4 |
| CHANGE_ORDER | CO | 4 |
| RFI | RFI | 4 |
| SUBMITTAL | SUB | 4 |

---

## 9. Background Jobs (PgBoss + Outbox Pattern)

### Outbox Pattern

Domain mutations write events to `outbox_events` table **within the same DB transaction** as the domain record. This guarantees atomicity — if the org-creation transaction rolls back, no outbox event is emitted.

`OutboxService.publishPendingEvents()` polls `PENDING` events and dispatches them to PgBoss queues. In tests, call this manually to flush events synchronously before inspecting outbox state.

### Queue Event Types

| Event Type | Triggered By | Payload |
|-----------|--------------|---------|
| `auth:send-email-verification` | Registration, resend-verification | `{ userId, email, token }` |
| `auth:send-password-reset` | Forgot password | `{ userId, email, token }` |
| `auth:send-password-changed-notification` | changePassword, resetPassword | `{ userId, email }` |
| `auth:send-new-login-notification` | Login, Google OAuth | `{ userId, email, ipAddress, userAgent }` |
| `org:send-invitation-email` | Create invitation | `{ invitationId, organizationId, email, orgName, inviterName, token }` |
| `org:expire-invitations` | Cron job | `{}` |

---

## 10. Test Infrastructure

### Framework

- **Vitest** — test runner, assertion library
- **Fastify `app.inject()`** — HTTP simulation (no real network, full middleware stack)
- **Real PostgreSQL** — tests run against a real DB (Docker Compose)
- **Real Redis** — RBAC permission cache is live
- **No mocks** — all dependencies are real

### Test App Factory

```typescript
import { createTestApp } from '../helpers/test-app.js';
// creates buildApp() + app.ready()
const app = await createTestApp();
// ...
await app.close();
```

### Auth in Tests

Option A — Bearer header (most tests):
```typescript
const token = createAccessToken({ sub: userId, email, status: 'ACTIVE' });
app.inject({ headers: { authorization: `Bearer ${token}` }, ... })
```

Option B — Cookie (testing cookie auth path):
```typescript
const { accessCookie } = await loginAndGetCookies(app, email, 'password123');
app.inject({ cookies: { access_token: accessCookie }, ... })
```

### Cookie Format

`@fastify/cookie` with `signed: true` produces cookies prefixed with `s:` (after URL-decode). The middleware calls `request.unsignCookie()` to extract the raw JWT.

When passing cookies via `app.inject({ cookies: { access_token: val } })`, pass the **raw signed value** (what `set-cookie` returned, after decoding).

---

## 11. Existing Test File Inventory

| File | What It Covers |
|------|---------------|
| `tests/integration/auth.test.ts` | Basic auth smoke tests (register validation, login validation, GET /me unauth, GET /sessions unauth) |
| `tests/integration/task1_organization_lifecycle.test.ts` | Org creation — slug derivation, atomic seeding of roles/profile/settings/sequences, settings PATCH |
| `tests/integration/task2_invitation_flow.test.ts` | Invitation → outbox event → acceptance → membership creation → audit trail |
| `tests/integration/task3_rbac_tenant_isolation.test.ts` | RBAC permission denial, tenant isolation (cross-tenant 403), role upgrade + Redis cache invalidation |
| `tests/integration/tenant-isolation.test.ts` | Additional tenant isolation scenarios |
| `tests/integration/organization_profile.test.ts` | Profile CRUD, unauthenticated 401, non-member 403, audit log |
| `tests/integration/organization_settings.test.ts` | Settings CRUD, validation, audit log |
| `tests/integration/document_sequences.test.ts` | Sequence list/get/update, nextValue stripping, invalid type 404, audit log |
| `tests/integration/health.test.ts` | Health endpoint checks |
| `tests/unit/auth/password.service.test.ts` | Unit tests for bcrypt hash/verify |

---

## 12. New Test Files (This Spec)

| File | Purpose |
|------|---------|
| `tests/helpers/fixtures.ts` | Shared fixture helpers: `createVerifiedUser`, `createUnverifiedUser`, `createOrgWithAdmin`, `addMemberDirectly`, `loginAndGetCookies`, `getInvitationTokenFromOutbox`, `getEmailVerificationTokenFromOutbox`, `getPasswordResetTokenFromOutbox`, `countOutboxEvents` |
| `tests/integration/auth_routes.test.ts` | Comprehensive auth route coverage: all validation, cookie auth, sessions, logout flows, verify email, forgot/reset password, change password |
| `tests/integration/organization_routes.test.ts` | Full org routes: creation validation, slug logic, profile CRUD, settings validation, document sequences RBAC + validation |
| `tests/integration/members_routes.test.ts` | Member RBAC matrix (all 7 roles), update/remove lifecycle, last-admin guard, Redis cache invalidation |
| `tests/integration/invitations_routes.test.ts` | Full invitation lifecycle: create (validation + RBAC), list, cancel, accept, expired token, re-invite after cancel |
