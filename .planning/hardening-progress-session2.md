# Hardening Progress - Session 2

## Completed Tasks

### P0-1: Close SSE streams on session revoke, member removal, and org suspend
**Status: DONE**

- ✅ Added `closeConnectionsForUser` and `closeConnectionsForOrganization` methods to `realtime.delivery.ts` (already done by previous agent)
- ✅ Wired into `platform-lifecycle.service.ts` for account suspend (line 75) and org suspension (lines 190-191)
- ✅ **NEW**: Added close call in `membership.service.ts` `removeMember` method to close SSE connections when a member is removed

**Files Modified:**
- `apps/server/src/modules/membership/membership.service.ts` - Added import and close call after member removal

**Remaining:**
- ✅ Integration tests verify account suspension/session revocation closes the user's stream within 1s.
- ✅ Integration tests verify member removal closes the stream within 1s and rejects reconnects with 403/404.
- ✅ Integration tests verify organization suspension closes streams for all active members within 1s.

---

### P0-4: Wire idempotency on platform writes
**Status: DONE**

- ✅ Idempotency helper exists at `platform-idempotency.ts` (created by previous agent)
- ✅ **NEW**: Added `idempotencyKey` optional field to `LifecycleActionInput` interface
- ✅ **NEW**: Wired `runIdempotentWrite` into:
  - `platformLifecycleService.reactivateAccount`
  - `platformLifecycleService.approveOrganizationSuspension`
  - `platformLifecycleService.reactivateOrganization`
  - `platformSupportGrantService.revokeGrant` (added `idempotencyKey` param)
  - `platformBillingService.triggerWebhookRecovery`
- ✅ **NEW**: Validated `Idempotency-Key` headers are passed by suspend, account/org reactivation, approval, support-grant revoke, and webhook-recovery routes.
- ✅ **NEW**: Integration coverage verifies same-key replay, different-body 409, and concurrent account-reactivation requests.

**Files Modified:**
- `apps/server/src/modules/platform/platform-lifecycle.service.ts`
  - Added import for `runIdempotentWrite`
  - Added `idempotencyKey?` to `LifecycleActionInput`
  - Wrapped reactivateAccount in idempotent write
  - Wrapped approveOrganizationSuspension in idempotent write
  - Wrapped reactivateOrganization in idempotent write

- `apps/server/src/modules/platform/platform-support-grant.service.ts`
  - Added import for `runIdempotentWrite`
  - Updated `revokeGrant` signature to accept `idempotencyKey`
  - Wrapped revokeGrant in idempotent write

- `apps/server/src/modules/platform/platform-billing.service.ts`
  - Added import for `runIdempotentWrite`
  - Wrapped triggerWebhookRecovery in idempotent write

### P0-2: Platform write audit trail
**Status: DONE**

- ✅ Integration tests assert lifecycle audit rows for account suspend/reactivate and organization suspension request/approval/reactivation.
- ✅ Support-grant HTTP tests assert request, approval, use, denied use, and revoke audit rows.
- ✅ Billing recovery HTTP test asserts one audit row per recovery execution.
- ✅ Rollback test forces a failure after the audit insert and verifies both the account mutation and audit row are rolled back.

### P0-3: Enforce rate limits by operator
**Status: DONE**

- ✅ The rate limiter runs after authentication and keys by platform user ID, with IP fallback for requests without an authenticated user.
- ✅ HTTP integration coverage exhausts one operator's 30/minute budget and verifies a second operator on the same loopback IP can still write.

### P0-5: Enforce organization reactivation policy
**Status: DONE**

- ✅ Billing status is rechecked under the organization row lock; `PAST_DUE` is allowed only while its recorded 7-day grace period is active.
- ✅ Integration tests cover blocked `UNPAID`/`RESTRICTED`/`CANCELED` and expired `PAST_DUE`, allowed `ACTIVE`/`TRIALING`/in-grace `PAST_DUE`, wrong source state, missing reason, and concurrent reactivation.

---

## Updated Task Tracker

| ID | Status | Done | Remaining |
|---|---|---|---|
| P0-1 SSE close | DONE | Methods wired for account/org suspension and membership removal; live SSE tests cover prompt closure, reconnect denial, and all-member closure | None |
| P0-2 Audit trail | DONE | Audit in lifecycle, support-grant, billing; tests cover each action and rollback atomicity | None |
| P0-3 Rate limit by operator | DONE | Pre-handler rate limit keys authenticated requests by platform user ID with IP fallback; same-IP integration coverage verifies independent budgets | None |
| P0-4 Idempotency | DONE | Five service writes are wrapped; validated headers reach target routes; account-reactivation replay, mismatch, and concurrency tested | None |
| P0-5 Reactivation policy | DONE | Transactional billing gate enforces blocked states and the 7-day `PAST_DUE` grace boundary; tests cover blocked/allowed/source/reason/concurrency cases | None |
| P0-6 Support data minimization | DONE | ownerUserId removed, ownerEmailMasked added | None |
| P0-7 Grace reminder preferences | PARTIAL | Billing-admin emails honor `billing.grace_reminder`; opt-outs reach durable `SUPPRESSED` state; existing transport retries and occurrence idempotency are preserved | Outbox/email-queue conversion deferred because Phase 10 Plan 10-09 explicitly requires its owned transport and rejects delegation to the notification-intent/worker path |
| P1-1 Consumer map | DONE | `docs/events/EVENT-CATALOG.md` maps registered consumers and unconsumed event families; document queues are mapped to the separately started document-worker process | P1-14 still expands dynamic project event families into one row per concrete event |
| P1-2 No-consumer dispositions | PARTIAL | Account suspended/reactivated email consumers are registered and unit-tested; operator-only events remain audit-only | Organization suspended/reactivated consumer and tenant-scope tests |
| P1-3 Billing/platform events | TODO | None | Emit billing status, entitlement, and grace transition events transactionally; register contracts and assert outbox rows |
| P1-4 Realtime event delivery | TODO | None | Route selected tenant events through `broadcastToTenant`; test tenant isolation |
| P1-5 Email preference gate | PARTIAL | Email worker checks per-recipient EMAIL preferences and cancels opted-out deliveries; matrix and opt-out integration test added | Run tests and confirm every non-security email producer uses this path or is documented |
| P1-6 Redis access | PARTIAL | Added bounded shared `deleteRedisKeysByPattern` and replaced duplicated supplier/material/RBAC scans without changing key formats | Add helper tests and run cache tests |
| P1-7 Diagnostics query safety | DONE | Queue diagnostics uses a bounded window and explicit pg-boss columns; route requires `read:diagnostics` and returns aggregates only | None |
| P1-8 Outbox dead-letter visibility | PARTIAL | Failed-event count/oldest timestamp/sanitized sample and audited single-row replay endpoint added; replay has a dedicated platform permission migration | Apply migration and add diagnostics/replay tests |
| P1-9 Tenant boundary tests | TODO | None | Add tenant-isolation coverage for every tenant-scoped event consumer |
| P1-10 Active-only seat count | PARTIAL | Seat check now counts only ACTIVE memberships and no longer reserves pending invitations | Integration test setup timed out before assertions; rerun and align expected seat-count assertion |
| P1-11 Platform RBAC map | DONE | `docs/platform/PLATFORM-RBAC.md` maps every route to its platform permission and OpenAPI schema | Keep synchronized with route changes |
| P1-12 Notification links/read state | TODO | None | Add persisted read state, notification consumer(s), SSE delivery, and channel matrix |
| P1-13 PgBoss retry/DLQ settings | TODO | None | Configure every queue, make consumers idempotent, and test redelivery |
| P1-14 Event catalog | PARTIAL | Catalog includes registered queue consumers, event families, and audit-only dispositions | Enumerate every concrete outbox event type and document each event's disposition |
| P2-1 Organization data lifecycle | TODO | User approved continuation across P2 tasks | Full tenant export, audited staged deletion, retention, and tenant-isolation tests |
| P2-2 Platform route docs parity | PARTIAL | Platform route-to-schema table added; platform routes currently declare route-level schemas | Automated/source-verified route/schema parity check |
| P2-3 Dead code | TODO | None | Review unused exports in platform/billing after P0/P1 |

---

## Prior Session Next Steps (superseded by the updated tracker above)

1. **Update route handlers** to accept `Idempotency-Key` header and pass to services
   - `platform.routes.ts` - all write operations

2. **P0-7**: Replace direct `sendGraceReminder` call with outbox event
   - File: `apps/server/src/modules/billing/lifecycle.service.ts:95`
   - Create consumer that respects preferences

3. **Run type check**: `cd apps/server && pnpm exec tsc --noEmit`
   - Fix any type errors from changes

4. **Run targeted tests**: Platform lifecycle, support grant tests
   - `pnpm test platform-lifecycle`
   - `pnpm test platform-support-grant`

5. **Add missing tests** for P0-1 and P0-4

6. **Begin P1 tasks** starting with P1-1 (consumer map documentation)

---

## Code Quality Notes

- All idempotent operations use consistent pattern with `runIdempotentWrite`
- Operations scoped by `actorUserId` + unique operation key
- Transaction boundaries preserved (idempotency wraps execute function)
- Error handling: Failed operations delete the idempotency key for retry

---

## Files That Need Route Handler Updates

`apps/server/src/modules/platform/platform.routes.ts`:
- POST `/accounts/:targetUserId/reactivate` - pass idempotencyKey
- POST `/approvals/:approvalId/approve` - pass idempotencyKey  
- POST `/organizations/:orgId/reactivate` - pass idempotencyKey
- POST `/support-grants/:grantId/revoke` - pass idempotencyKey
- POST `/billing/webhook-recovery` - pass idempotencyKey

Header extraction: `const idempotencyKey = request.headers['idempotency-key'] as string | undefined;`
