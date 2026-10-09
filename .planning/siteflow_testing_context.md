# SiteFlow — API Route Integration Testing Standard

**Status:** Mandatory
**Audience:** AI coding agents and developers writing, reviewing, or modifying backend tests
**Scope:** `apps/server` API routes and their integration behavior
**Primary test location:** `tests/integration/`
**Unit test location:** `tests/unit/`

---

## 1. Purpose

This document is the mandatory testing contract for SiteFlow backend route tests.

An agent MUST read this document completely before creating, modifying, or reviewing an integration test.

The objective is **behavioral correctness**, not merely endpoint coverage or line coverage.

A route is considered adequately tested only when its relevant:

* success paths
* validation failures
* authentication failures
* authorization failures
* tenant-isolation boundaries
* ownership boundaries
* business rules
* state transitions
* database invariants
* transaction/rollback behavior
* idempotency behavior
* concurrency behavior
* event/outbox behavior
* background-job behavior
* cache behavior
* external dependency failures
* security boundaries
* error contracts
* observability behavior

have been considered and tested where applicable.

Do not interpret this as requiring every test category for every trivial route. The agent MUST determine which categories apply to the route and explicitly cover every applicable category.

---

# 2. SiteFlow Testing Architecture

## 2.1 Application stack

The backend uses:

* Node.js
* TypeScript
* Fastify
* Drizzle ORM
* PostgreSQL
* Redis
* PgBoss
* Transactional Outbox
* OpenTelemetry
* Pino structured logging

The backend application is located in:

```text
apps/server/
```

The shared database package is:

```text
packages/database/
```

---

## 2.2 Route-level integration testing is the default

Route integration tests MUST use:

```ts
app.inject(...)
```

against a real Fastify application created through the same application factory used by production.

The test application MUST be created through:

```text
createTestApp()
    ↓
buildApp()
    ↓
app.ready()
```

Do NOT:

* instantiate route handlers directly
* construct fake `request` objects
* construct fake `reply` objects
* bypass Fastify hooks
* bypass serialization
* bypass error handlers
* replace the complete middleware chain with mocks

The purpose of route integration testing is to exercise the real application lifecycle.

This catches:

* incorrect route registration
* incorrect route paths
* middleware ordering errors
* authentication failures
* authorization failures
* organization-context failures
* project-context failures
* serializer problems
* Fastify error-handler behavior
* plugin registration problems
* rate-limit behavior
* security middleware behavior

The existing architecture intentionally uses this model because mocked request/reply tests are structurally blind to these failures.

---

# 3. Unit Tests vs Integration Tests

## 3.1 Unit tests

Unit tests belong in:

```text
tests/unit/
```

Use unit tests primarily for deterministic, isolated logic such as:

* password hashing/verification
* pure RBAC logic
* membership utilities
* calendar calculations
* schedule calculations
* validation utilities
* pure transformation functions
* other deterministic functions with no Fastify lifecycle dependency

Do NOT introduce mocked Fastify request/reply objects merely to increase unit-test coverage.

If logic can be tested as a pure function, prefer extracting the pure function and testing it independently.

---

## 3.2 Integration tests

Integration tests belong in:

```text
tests/integration/
```

Use integration tests for:

* API routes
* authentication
* authorization
* tenant isolation
* database persistence
* transactions
* state transitions
* caching behavior where externally observable
* outbox behavior
* PgBoss integration
* cross-module behavior
* concurrency
* route-level security
* error handling
* complete request/response behavior

---

# 4. Real Infrastructure Policy

Integration tests MUST use real infrastructure wherever the existing test environment provides it.

Current architecture:

```text
Fastify
   │
   ├── PostgreSQL
   ├── Redis
   └── PgBoss
```

The integration suite uses a dedicated PostgreSQL test instance.

Current test database port:

```text
5434
```

The tests MUST NOT silently switch to:

* SQLite
* an in-memory database
* mocked Drizzle
* mocked PostgreSQL
* mocked Redis
* mocked transaction behavior

unless the test specifically targets an isolated unit-level failure and belongs in `tests/unit/`.

Real PostgreSQL is important because the application depends on real:

* constraints
* transactions
* indexes
* unique constraints
* CHECK constraints
* locking
* query behavior
* `FOR UPDATE`
* `FOR UPDATE SKIP LOCKED`
* PostgreSQL notifications
* PgBoss persistence

---

# 5. Database Isolation — Critical Rule

## 5.1 Current strategy

The integration database is NOT reset, truncated, or rolled back between every test.

Tests isolate their data using randomized identifiers.

Typical pattern:

```ts
const runId = Math.random().toString(36).substring(7);
```

Use the run identifier in test-owned unique values such as:

```text
email
slug
codes
names where appropriate
tokens where appropriate
external references
```

This strategy MUST NOT be removed or replaced unilaterally.

---

# 6. The Unscoped Query Hazard

Randomized identifiers isolate rows created by the test.

They do NOT isolate aggregate queries.

This is dangerous:

```sql
SELECT COUNT(*) FROM audit_logs;
```

because the table contains data from previous tests and previous test runs.

Therefore the following are prohibited unless there is an explicit reason and the query is intentionally global:

```sql
COUNT(*)
SELECT *
ORDER BY ...
LIMIT ...
```

without a test-specific scope.

The existing testing document identifies `countOutboxEvents` as a known example of this problem.

---

# 7. Mandatory Fixture Scope

Every new fixture helper MUST accept an appropriate scope.

Preferred scope:

```text
runId
```

or:

```text
tenantId / organizationId
resourceId
userId
projectId
```

depending on the assertion.

Example:

```ts
await getAuditLogs({
  organizationId,
  resourceId,
});
```

is preferable to:

```ts
await getAllAuditLogs();
```

for an assertion about a specific test operation.

Never create a generic helper that encourages global assertions such as:

```ts
countOutboxEvents()
```

unless it requires a scope.

---

# 8. Mandatory Pre-Test Audit

Before extending `fixtures.ts` or adding an assertion involving database state, inspect existing fixture helpers for:

* unscoped `COUNT(*)`
* unscoped `SELECT`
* unscoped `ORDER BY ... LIMIT`
* "latest row" helpers
* "no rows exist" helpers
* aggregate queries without tenant/resource/run scope

Do not silently repair unrelated existing helpers.

If an unrelated unscoped query is discovered:

1. identify it
2. avoid relying on it
3. report it
4. fix it only if the current task explicitly includes that hardening work

---

# 9. The Route Testing Matrix

For every route, determine applicability across the following dimensions.

```text
                 ROUTE
                   │
 ┌─────────────────┼──────────────────┐
 ↓                 ↓                  ↓
Input            Identity           State
 ↓                 ↓                  ↓
Validation       AuthN/AuthZ        Transitions
 ↓                 ↓                  ↓
Business Rules   Tenant             Idempotency
                  Ownership
 └─────────────────┬─────────────────┘
                   ↓
              Persistence
                   ↓
        ┌──────────┼───────────┐
        ↓          ↓           ↓
    Transaction  Events      Cache
        ↓          ↓           ↓
      Jobs       Outbox      Redis
        └──────────┼───────────┘
                   ↓
              Concurrency
                   ↓
          External Failures
                   ↓
             Observability
```

The agent MUST NOT stop after proving that the happy path returns `200`/`201`.

---

# 10. Functional Correctness

Every route MUST have a valid-path test.

The happy-path test MUST verify more than the HTTP status.

Where applicable, verify:

* HTTP status
* response shape
* returned identifiers
* returned fields
* persisted database state
* relationships
* derived values
* status
* timestamps where deterministic
* side effects
* events/outbox records
* jobs
* cache invalidation
* audit records

Example:

```text
POST /projects
        ↓
201
        ↓
project returned
        ↓
project persisted
        ↓
project_settings persisted
        ↓
project number allocated
        ↓
creator membership persisted
        ↓
creator role correct
        ↓
expected event/outbox state
```

Do not consider the route tested merely because its HTTP response is correct.

---

# 11. Input Validation

For every request field, consider:

### Required fields

Test:

* missing field
* `null`
* empty string
* whitespace-only string where relevant
* wrong type
* malformed value

### Strings

Test:

* minimum valid length
* maximum valid length
* one character below minimum
* one character above maximum
* unexpected whitespace
* invalid format
* Unicode where relevant

### Numbers

Test:

* zero
* negative
* minimum
* maximum
* just below minimum
* just above maximum
* decimal values
* excessive precision
* extremely large values

### Arrays

Test:

* missing
* empty
* one item
* maximum allowed size
* above maximum
* duplicate values
* malformed elements

### Objects

Test:

* missing
* empty
* malformed nested object
* unexpected fields
* privileged fields supplied by client

---

# 12. Client-Controlled Privileged Fields

A client MUST NOT be able to modify server-controlled fields simply by adding them to a request body.

Where applicable, test payloads containing fields such as:

```json
{
  "role": "Organization Admin",
  "organizationId": "other-org",
  "userId": "other-user",
  "status": "APPROVED",
  "version": 999999,
  "createdAt": "...",
  "approvedBy": "attacker"
}
```

The route MUST either:

* reject them, or
* ignore them

according to the API contract.

The client MUST NOT gain privileges or bypass workflow rules through payload manipulation.

---

# 13. Authentication Testing

Protected routes MUST cover:

### No credentials

```text
No Authorization header
No authentication cookie
→ 401
```

### Invalid credentials

Test:

* malformed JWT
* invalid JWT signature
* expired JWT
* tampered JWT
* invalid token format
* invalid bearer token

### Cookie authentication

Because SiteFlow supports both Bearer authentication and signed cookies, protected routes SHOULD verify the intended behavior for both mechanisms where relevant.

### User lifecycle

Test authentication behavior for:

* deleted user
* disabled/inactive user if applicable
* invalid session
* revoked session
* expired session

---

# 14. Authentication Source Ambiguity

The application supports:

```text
Authorization: Bearer <token>
```

and:

```text
access_token cookie
```

Where both credentials are supplied, the test MUST verify the application's defined precedence/security behavior.

Do not assume precedence.

Inspect the authentication implementation and test the actual intended contract.

---

# 15. Authorization / RBAC

Every protected route MUST test authorization.

At minimum:

```text
correct permission → allowed
missing permission → 403
```

But this is insufficient for sensitive functionality.

Test:

* exact required permission
* neighboring/insufficient permission
* role boundary
* multiple roles
* inherited permissions where applicable
* permission removed
* permission added
* stale cached permissions where relevant

SiteFlow uses:

```text
authenticate
    ↓
organizationContext
    ↓
requirePermission(...)
```

and project-level:

```text
projectContext
    ↓
requireProjectPermission(...)
```

Both layers must be considered where applicable.

---

# 16. Permission Boundary Testing

Do not write only:

```text
Admin succeeds
User fails
```

Determine the exact permission model.

If the route requires:

```text
project:update
```

test:

```text
has project:update → success
does not have project:update → 403
```

If permissions are hierarchical, test the exact boundary.

Do not assume that a role name implies a permission.

---

# 17. Horizontal Authorization / Ownership

RBAC does NOT prove resource ownership.

Always consider:

```text
User A owns resource A
User B owns resource B
```

Then test:

```text
User A → resource A     ✅
User A → resource B     ❌
User B → resource A     ❌
```

This applies especially to:

* projects
* project members
* documents
* audit logs
* procurement records
* schedules
* field logs
* issues
* invitations
* suppliers
* materials
* purchase orders
* receipts
* other organization/project resources

---

# 18. Multi-Tenancy

Tenant isolation is a mandatory security boundary.

Every organization-scoped route MUST be evaluated for:

```text
Organization A
Organization B
```

Create actual data in both organizations within the test when cross-tenant behavior matters.

Then verify:

```text
Org A user → Org A resource      ✅
Org A user → Org B resource      ❌
Org B user → Org A resource      ❌
```

Do NOT rely on a clean database.

---

# 19. Tenant Spoofing

Organization identity is derived from authenticated session context.

The client MUST NOT be able to override it through:

* request body
* query parameter
* path parameter where the architecture treats it as context
* arbitrary tenant header

If an organization identifier is accepted as part of a route, test that it cannot be used to escape the authenticated organization context.

Where a mismatched tenant identifier is supplied, verify that the server:

* rejects the request, or
* safely ignores the client-supplied value

according to the implementation contract.

---

# 20. IDOR / Resource Enumeration

For resource endpoints:

```text
GET /resource/:id
PATCH /resource/:id
DELETE /resource/:id
POST /resource/:id/...
```

test access using:

* valid own resource ID
* another tenant's resource ID
* another user's resource ID
* nonexistent resource ID
* malformed resource ID

Do not assume UUIDs make IDOR impossible.

Authorization must be enforced regardless of identifier format.

---

# 21. Cross-Tenant Foreign Keys

Where a request references another resource, verify that referenced resources belong to the same allowed tenant/project context.

Example:

```text
Org A project
Org B cost code
```

Attempt:

```text
Create Org A resource
using Org B costCodeId
```

Expected behavior must reject the cross-tenant reference.

This applies to:

* projects
* phases
* cost codes
* tasks
* suppliers
* materials
* subcontractors
* quotes
* purchase orders
* receipts
* approvals
* other foreign-key relationships

---

# 22. List and Search Endpoints

List endpoints are high-risk for tenant leakage.

If:

```text
Org A → Resource A
Org B → Resource B
```

then an Org A list request MUST NOT contain Resource B.

Do NOT prove this only by asserting:

```text
count === 1
```

because accumulated test data makes such an assertion unsafe.

Prefer:

```ts
expect(response.body.data).not.toContainEqual(
  expect.objectContaining({
    id: orgBResource.id,
  }),
);
```

or equivalent resource-specific assertions.

---

# 23. Bulk Operations

Bulk operations require additional scrutiny.

For:

```text
bulk update
bulk delete
bulk transition
bulk assign
```

test:

```text
all resources belong to current tenant
mixed tenant resource IDs
nonexistent IDs
duplicate IDs
empty input
large input
partial failure behavior
```

A missing tenant filter in a bulk operation can affect many records at once.

---

# 24. Error Contract

Every meaningful failure path MUST verify:

* HTTP status
* error response shape
* stable error code if defined
* message where contractually relevant
* absence of sensitive information

Never expose:

* stack traces
* SQL errors
* database connection information
* internal filesystem paths
* secrets
* authentication tokens
* cookies
* password hashes
* internal implementation details

---

# 25. Resource Existence Leakage

For tenant-protected resources, determine the intended behavior when a resource exists but belongs to another tenant.

The response MUST NOT unnecessarily reveal:

```text
"This resource exists but belongs to another organization."
```

Where the security contract requires indistinguishable behavior, test that:

```text
nonexistent resource
```

and:

```text
existing resource belonging to another tenant
```

produce equivalent externally observable responses.

---

# 26. State Machines

Any resource with lifecycle states MUST be tested as a state machine.

For example:

```text
DRAFT
  ↓
ACTIVE
  ↓
ON_HOLD
  ↓
ACTIVE
  ↓
COMPLETED
```

Do NOT test only valid transitions.

For every important state:

### Allowed transition

```text
current state → allowed next state
```

### Forbidden transition

```text
current state → invalid next state
```

### Terminal state

Verify that terminal states cannot be modified through prohibited transitions.

### Permission

Verify that transition endpoints enforce the required permission.

### Side effects

Verify transition-specific:

* DB updates
* audit logs
* outbox events
* jobs
* derived data
* cache invalidation

---

# 27. SiteFlow State Machines

Agents MUST inspect the implementation for all applicable state machines.

Known examples include:

### Project

```text
DRAFT
→ ACTIVE
→ ON_HOLD
→ ACTIVE
→ COMPLETED / CANCELLED
→ ARCHIVED
```

### Tasks

```text
NOT_STARTED
READY
IN_PROGRESS
BLOCKED
COMPLETED
CANCELLED
```

### Baselines

```text
DRAFT
→ ACTIVE
```

### Field Logs

```text
DRAFT
→ SUBMITTED
→ LOCKED
```

### Issues

```text
OPEN
→ IN_PROGRESS
→ RESOLVED
→ CLOSED
```

### Material Requests

```text
DRAFT
→ SUBMITTED
→ UNDER_REVIEW
→ APPROVED
→ PARTIALLY_ORDERED
→ ORDERED
→ FULFILLED
```

plus:

```text
CANCELLED
REJECTED
```

### Quotes

```text
DRAFT
→ SUBMITTED
→ ACCEPTED / REJECTED / EXPIRED
```

### Purchase Orders

```text
DRAFT
→ PENDING_APPROVAL
→ APPROVED
→ SENT
→ ACKNOWLEDGED
→ PARTIALLY_RECEIVED
→ RECEIVED
```

plus:

```text
CANCELLED
CLOSED
```

These transitions are derived from the current implementation report.

If implementation differs from this document, the agent MUST inspect the source of truth rather than inventing behavior.

---

# 28. Idempotency

Any operation that may be retried MUST be evaluated for idempotency.

Test repeated execution where applicable:

```text
same request
same resource
same idempotency key
same event
same webhook
same transition
```

Expected result must follow the API contract.

Examples:

```text
DELETE
POST transition
approval
webhook processing
job execution
outbox dispatch
```

Do not automatically assume every POST must be idempotent. Determine the intended contract.

---

# 29. Duplicate Operations

Explicitly test duplicate requests for operations where duplication could cause corruption.

Examples:

```text
accept invitation twice
approve twice
submit twice
receive same delivery twice
void same receipt twice
activate baseline twice
create duplicate pending approval
```

Verify database constraints and application logic prevent invalid duplication.

---

# 30. Database Invariants

After successful mutations, verify the database state.

Test:

```text
record exists
correct organizationId
correct projectId
correct owner/actor
correct foreign keys
correct status
correct derived fields
correct version
correct timestamps where relevant
```

Also test constraints such as:

* unique constraints
* CHECK constraints
* foreign keys
* partial unique indexes
* non-null constraints

Do not rely only on application validation.

The database is part of the production behavior.

---

# 31. Transaction Testing

Whenever a route performs multiple related writes inside a transaction, test atomicity.

Example:

```text
create organization
    ↓
create profile
    ↓
create settings
    ↓
create default roles
    ↓
create membership
```

If a later operation fails, verify that partial state does not remain.

Expected:

```text
transaction fails
      ↓
ROLLBACK
      ↓
no orphaned partial records
```

The SiteFlow organization creation flow explicitly performs related creation in a single transaction.

---

# 32. Transaction Failure Injection

Where practical, deliberately cause a downstream operation inside the transaction to fail.

Then verify:

```text
primary record absent
dependent records absent
outbox record absent
no partial mutation
```

Do not create artificial mocks merely to satisfy this requirement if the existing integration architecture provides a better deterministic failure mechanism.

If failure injection is impractical for a particular route, document that limitation rather than pretending rollback is covered.

---

# 33. Transactional Outbox

SiteFlow uses a transactional outbox.

Domain writes that need asynchronous processing use:

```text
writeOutboxEvent(tx, ...)
```

inside the same database transaction.

The system then uses PostgreSQL `NOTIFY` plus polling fallback for dispatch.

For routes that produce outbox events, test:

### Success

```text
business write succeeds
outbox event exists
event references correct entity
event contains expected event type/payload
```

### Transaction failure

```text
business write fails
outbox event is not committed
```

### Event correctness

Verify:

* event type
* aggregate/resource ID
* organization ID where applicable
* payload
* event uniqueness/idempotency fields where applicable

---

# 34. Outbox Assertion Rules

Never write:

```ts
expect(await countOutboxEvents()).toBe(1);
```

if the helper queries the entire table.

Prefer:

```text
find event for this runId/resourceId/organizationId
```

Then assert against that specific event.

For negative tests:

```text
assert no event exists for this specific resource/action
```

Never:

```text
assert global outbox count === 0
```

---

# 35. PgBoss / Background Jobs

Routes that enqueue work MUST be tested for the expected job/outbox behavior.

Where practical verify:

```text
route
 ↓
transaction
 ↓
outbox
 ↓
dispatch
 ↓
PgBoss job
```

Test:

* correct queue
* correct payload
* correct resource identifier
* correct tenant context
* duplicate prevention where applicable
* retry behavior where applicable
* failure behavior
* idempotent worker behavior

Do not require every route integration test to execute the entire worker stack if doing so makes the suite nondeterministic. Separate route-level enqueue assertions from dedicated worker integration tests where appropriate.

---

# 36. Retry Behavior

For systems with retries, test that retry does not create duplicate business effects.

Example:

```text
attempt 1 → business operation succeeds
delivery acknowledgement fails
attempt 2 → same operation executes
```

The final business state must remain correct.

This is particularly important for:

* PgBoss
* outbox dispatch
* email jobs
* schedule recalculation
* notifications
* procurement events

---

# 37. Concurrency

Concurrency testing is mandatory where simultaneous requests can violate a business invariant.

Use actual concurrent requests where possible:

```ts
await Promise.all([
  app.inject(requestA),
  app.inject(requestB),
]);
```

Then verify the final database state.

Do NOT assume sequential tests prove concurrency correctness.

---

# 38. SiteFlow Concurrency Hotspots

Pay particular attention to:

### Optimistic project concurrency

Projects use a:

```text
version
```

column.

Test:

```text
Request A reads version N
Request B reads version N
Request A updates → success
Request B updates → stale-version conflict
```

Verify that stale writes cannot silently overwrite newer state.

### Schedule calculation

The schedule system uses revisions and stale revision detection.

Test:

```text
calculation A starts
revision changes
calculation A completes
stale result is discarded
```

### Singleton jobs

For async schedule calculation, test that duplicate requests do not create duplicate effective recalculations where `singletonKey` is intended to deduplicate them.

### Unique resources

Test concurrent creation against unique constraints where relevant.

---

# 39. Locking

Where the implementation uses database locking, tests MUST verify the business outcome that locking is intended to protect.

SiteFlow uses PostgreSQL locking for dependency cycle detection and `FOR UPDATE SKIP LOCKED` in outbox dispatch.

Do not test only that a lock statement exists.

Test:

```text
concurrent operation
→ invariant remains valid
```

---

# 40. Redis / Cache Testing

Redis is used for:

* auth caching
* RBAC permissions
* project context
* procurement caching
* rate limiting

The application is designed so Redis reads are fail-open for business operations.

For cache-backed behavior, consider:

### Cache hit

Expected result is correct.

### Cache miss

Expected result is correct.

### Cache invalidation

After mutation:

```text
old cached value
    ↓
mutation
    ↓
cache invalidated
    ↓
subsequent read reflects DB
```

### Redis unavailable

For fail-open functionality:

```text
Redis unavailable
    ↓
business operation still succeeds/falls back
```

unless the specific feature intentionally requires Redis.

---

# 41. RBAC Cache Invalidation

RBAC permissions are Redis-cached and invalidated synchronously after role changes.

Where a route changes permissions/roles:

```text
role/permission mutation
    ↓
cache invalidation
    ↓
subsequent authorization check
```

must be tested.

Example:

```text
User initially lacks permission → 403
grant permission
→ request succeeds

revoke permission
→ request returns 403
```

Do not let a stale Redis cache create false test results.

---

# 42. Cache Must Never Become an Authorization Boundary

A cached permission/resource result must never allow cross-tenant or unauthorized access.

Test cache-key isolation where relevant:

```text
Org A + User A
≠
Org B + User A
```

For known SiteFlow RBAC keys:

```text
rbac:perms:{orgId}:{userId}
```

ensure tenant identifiers are part of the isolation model.

---

# 43. Rate Limiting

SiteFlow has:

```text
global: 300 requests/minute per user
auth: 10 requests/15 minutes per IP
```

and login-specific attempt limiting.

Where a route is affected by rate limiting, test:

```text
below limit → succeeds
at limit → expected behavior
above limit → 429
```

For auth routes, verify the stricter limit.

---

# 44. Noisy Neighbor Testing

If rate limits are tenant/user scoped, verify one actor does not consume another actor's allowance incorrectly.

Example:

```text
User A → exceeds limit
User B → still allowed
```

Where the limiter is organization-aware, verify the intended organization boundary.

---

# 45. Request Body Limits

SiteFlow has a configurable body limit, defaulting to approximately 1 MB.

For endpoints accepting significant payloads, test:

```text
small valid payload → success
payload near limit → expected
payload above limit → rejection
```

Do not generate unnecessarily huge test payloads if a smaller deterministic payload can trigger the configured boundary.

---

# 46. Request Timeout

Where request timeout behavior is relevant, test that a deliberately slow operation does not leave the API hanging indefinitely.

Verify:

* expected timeout response
* no corrupted partial state
* transaction cleanup
* no duplicate background operation

Do not make the entire integration suite dependent on long real-time sleeps. Use deterministic timeout/failure injection where possible.

---

# 47. Security Middleware

Because SiteFlow uses global security middleware, route integration tests should preserve the real application stack.

Where security headers are part of the API contract, verify representative responses contain the expected headers.

Do not replace the real Fastify application with a minimal route-only server.

The production application includes Helmet, CORS, signed cookies, rate limiting, body limits, and request timeouts.

---

# 48. Cookie Security

Authentication uses signed cookies.

Where authentication is tested through cookies, verify invalid/tampered signatures are rejected.

Never expose cookie values in:

* logs
* assertion output
* snapshots
* test failure messages where avoidable

---

# 49. Sensitive Data Leakage

Integration tests MUST inspect relevant responses for accidental leakage of:

```text
password hash
session hash
refresh token
verification token
password reset token
cookie secret
authorization header
internal database errors
```

Authentication implementation stores sensitive tokens as hashes where applicable. Tests must not accidentally assert or expose the raw values beyond the required flow.

---

# 50. Authentication-Specific Tests

For authentication routes, consider:

### Registration

```text
valid registration
duplicate email
invalid email
invalid password
missing fields
password hashing
session creation
verification token creation
outbox creation
transaction rollback
```

### Login

```text
valid credentials
wrong password
unknown email
rate limit
cache hit
cache miss
session creation
lastLoginAt
notification/outbox behavior
```

### Refresh

```text
valid refresh
expired refresh
invalid refresh
revoked session
rotation
old refresh reuse
concurrent refresh attempts
```

### Email verification

```text
valid token
invalid token
expired token
already verified
token reuse
resend rate limit
```

### Password reset

```text
unknown account
valid reset
invalid token
expired token
token reuse
weak password
change password
session invalidation where specified
```

### Google OAuth

Where tested at integration level:

```text
valid callback
invalid state
PKCE mismatch
invalid authorization code
existing account linking
new account creation
```

Do not make tests dependent on Google's live service. External OAuth provider behavior should be isolated through an appropriate test strategy.

The current authentication functionality includes these flows and their associated session/token behavior.

---

# 51. Organization Lifecycle Tests

For organization creation and management, verify:

```text
organization
profile
settings
default roles
creator membership
```

are consistent.

Test:

```text
valid creation
duplicate/invalid data
transaction failure
suspended organization
archived organization
non-member access
cross-org access
```

For:

```text
ACTIVE
SUSPENDED
ARCHIVED
```

verify that protected routes behave according to the organization's state.

---

# 52. Invitation Tests

Invitation workflows MUST test:

```text
create invitation
duplicate pending invitation
invalid token
expired token
valid acceptance
already accepted
already expired
cross-organization misuse
membership creation
invitation status transition
outbox/email event
```

Because pending invitations use a partial unique index, duplicate behavior must be tested against the real database constraint.

---

# 53. Audit Log Testing

For operations that are contractually auditable, verify:

```text
audit action
actor
resource type
resource ID
organization
project where applicable
metadata
```

For permission denial:

```text
request denied
↓
permission.denied audit event
```

Where audit logging is asynchronous, test the correct eventual behavior rather than assuming the log is synchronously committed in the same HTTP response.

Never use an unscoped audit-log count.

---

# 54. Project Testing

Project routes MUST consider:

* organization isolation
* project membership
* project permission
* CRUD
* optimistic concurrency
* lifecycle transitions
* project number allocation
* creator membership
* project settings
* phases
* cost codes
* reorder behavior
* cache invalidation

The project module uses optimistic concurrency through a `version` column and dedicated lifecycle transition endpoints.

---

# 55. Schedule Testing

Schedule functionality requires deeper testing than ordinary CRUD.

For route-level tests, verify:

* valid task creation/update
* task type restrictions
* summary-task restrictions
* invalid summary fields
* dependency validation
* self-reference rejection
* cycle rejection
* permission boundaries
* project boundaries
* revision behavior
* asynchronous dispatch behavior
* stale result handling
* failure status
* metrics refresh

Pure schedule mathematics belongs in unit tests.

The integration suite should verify that API requests correctly integrate those calculations into the persistence/job lifecycle.

---

# 56. Dependency Testing

For dependency routes, test:

```text
FS
SS
FF
SF
```

and:

```text
positive lag
zero lag
negative lag if supported
invalid lag
self-reference
existing cycle
cross-project dependency
cross-tenant dependency
duplicate dependency
```

Cycle detection uses PostgreSQL reachability inside a locked transaction, so concurrency and database behavior matter here.

---

# 57. Async Schedule Testing

For schedules below the async threshold:

```text
< 100 tasks
→ synchronous calculation
```

For schedules at/above the async threshold:

```text
≥ 100 tasks
→ PgBoss job
```

Test both paths.

Also test:

```text
job succeeds
job fails
scheduleStatus = CALCULATING
scheduleStatus = IDLE
scheduleStatus = FAILED
stale revision discarded
duplicate calculation deduplicated
metrics refreshed
```

These are explicit parts of the implemented schedule architecture.

---

# 58. Immutable Resources

Where the business model says a resource becomes immutable, test attempted mutations after the immutable state.

Known example:

```text
Field Log:
DRAFT → SUBMITTED → LOCKED
```

After:

```text
LOCKED
```

the original log MUST NOT be mutated through ordinary update routes.

Amendment/correction workflows must be tested separately.

---

# 59. Derived Data

Whenever data is derived from another source, verify the relationship.

Examples:

```text
summary task dates
summary progress
committed costs
inventory balance
schedule metrics
partner performance
```

Test:

```text
source mutation
↓
derived data update
```

Also test stale-cache behavior where derived data is cached.

---

# 60. Inventory / Financial Data

For financial or inventory-related routes, test:

* zero values
* positive values
* negative values where prohibited
* decimal precision
* large values
* duplicate operations
* void/reversal behavior
* concurrent modifications
* derived balance
* tenant/project scope

Never assume a successful HTTP response proves ledger correctness.

Verify the persisted records and final aggregate.

---

# 61. Procurement Lifecycle

For procurement routes, test every allowed and prohibited lifecycle transition.

For example:

```text
Purchase Order
DRAFT
→ PENDING_APPROVAL
→ APPROVED
→ SENT
→ ACKNOWLEDGED
→ PARTIALLY_RECEIVED
→ RECEIVED
```

and:

```text
CANCELLED
CLOSED
```

Also test:

```text
approval duplication
approval ownership
cross-project references
cross-tenant references
quote sourcing
line-item totals
tax/discount calculations
receipt behavior
inventory effects
committed-cost effects
```

---

# 62. External Services

Never assume external services always succeed.

For routes interacting with external infrastructure, consider:

```text
success
4xx
5xx
timeout
connection failure
malformed response
duplicate callback
delayed callback
```

The test MUST verify the application's intended behavior under failure.

For external providers that cannot safely be called during tests:

* use deterministic test doubles at the integration boundary
* do not mock the route itself
* keep the Fastify/application/database behavior real

---

# 63. Email Testing

SiteFlow email delivery is decoupled from transactional routes.

Routes should generally verify:

```text
business transaction
+
outbox event
```

rather than requiring an actual external email delivery.

Dedicated worker tests should verify:

```text
outbox/job
→ email worker
→ EmailService
```

Test email failures where worker retry behavior matters.

---

# 64. Observability

Observability is part of production behavior.

SiteFlow uses:

* OpenTelemetry
* SigNoz/OTLP
* Pino
* request IDs
* span wrappers
* sensitive-header redaction

The application generates request IDs with `crypto.randomUUID()` and redacts authorization/cookie headers from logs.

Do not make every integration test assert implementation-specific span internals.

Instead, maintain dedicated observability coverage for:

```text
request
→ trace
→ important operation spans
→ errors recorded
→ request ID propagation
→ sensitive fields redacted
```

At minimum, security-sensitive logging MUST NOT leak:

```text
Authorization
Cookie
password
tokens
secrets
```

---

# 65. Regression Testing

When fixing a bug:

1. reproduce the bug with a test
2. verify the test fails against the old behavior
3. implement the fix
4. verify the test passes
5. run the relevant regression suite

Do not fix a production bug without adding a regression test unless technically impossible.

---

# 66. Test Naming

Test names MUST describe behavior.

Prefer:

```text
denies a project update when the user lacks project:update permission
```

over:

```text
should return 403
```

Prefer:

```text
does not expose Org B project in Org A project list
```

over:

```text
tenant test
```

Prefer:

```text
rejects stale project version during concurrent update
```

over:

```text
version test
```

A test name should tell an engineer what business guarantee is protected.

---

# 67. Test Structure

Prefer a structure like:

```ts
describe("PATCH /api/v1/projects/:id", () => {
  describe("authorization", () => {
    // ...
  });

  describe("validation", () => {
    // ...
  });

  describe("tenant isolation", () => {
    // ...
  });

  describe("business rules", () => {
    // ...
  });

  describe("concurrency", () => {
    // ...
  });

  describe("persistence", () => {
    // ...
  });
});
```

Organize by behavior, not implementation file.

---

# 68. Fixture Rules

Fixtures MUST:

* create only data needed by the test
* use randomized identifiers
* make ownership explicit
* make tenant/project relationships explicit
* avoid hidden global state
* avoid relying on previous tests
* avoid unscoped queries

Prefer explicit fixture composition:

```ts
const orgA = await createOrganization({ runId });
const orgB = await createOrganization({ runId });

const userA = await createUser({ runId });
const userB = await createUser({ runId });

const projectA = await createProject({
  organizationId: orgA.id,
  runId,
});
```

This makes security boundaries visible.

---

# 69. Never Depend on Test Ordering

Tests MUST be independently executable.

This must work:

```text
run complete suite
```

and:

```text
run only test X
```

without changing correctness.

Never assume:

```text
test A created the user
test B created the organization
test C changed the role
```

Tests must establish their own required state.

---

# 70. Never Use Time Accidentally

Tests involving:

* expiry
* sessions
* invitations
* verification tokens
* password reset tokens
* TTLs
* scheduling

must control time where possible.

Avoid fragile assertions such as:

```ts
expect(timestamp).toBe(Date.now())
```

Prefer bounded or deterministic assertions.

If fake timers are appropriate, use them deliberately and restore them after the test.

---

# 71. Avoid Flaky Async Assertions

Do not use arbitrary:

```ts
await new Promise(resolve => setTimeout(resolve, 5000));
```

to "wait for the system."

Prefer:

* deterministic polling with a bounded timeout
* explicit job completion checks
* database state checks
* test hooks
* deterministic worker execution

A test that passes only because a developer's machine happened to wait long enough is not reliable.

---

# 72. Testing Negative Paths Is Mandatory

A production-grade route suite should not be dominated by happy paths.

For each route, actively search for:

```text
What happens if this is missing?
What happens if this is invalid?
What happens if this belongs to someone else?
What happens if this belongs to another tenant?
What happens if the resource is in the wrong state?
What happens if the request is repeated?
What happens if two requests happen simultaneously?
What happens if the database operation fails?
What happens if Redis fails?
What happens if the background operation fails?
What happens if the event is duplicated?
What happens if the client sends privileged fields?
```

These questions are mandatory reasoning prompts for the agent.

---

# 73. Coverage Is Not Line Coverage

Do NOT use:

```text
100% lines covered
```

as evidence that a route is adequately tested.

Line coverage can be high while the suite misses:

* IDOR
* tenant leakage
* race conditions
* duplicate processing
* invalid state transitions
* transaction rollback
* lost events
* stale cache authorization
* privilege escalation
* information leakage

The target is **behavioral and boundary coverage**.

---

# 74. Required Route Review Matrix

Before declaring a route complete, the agent MUST mentally or explicitly evaluate:

| Category                    | Applicable? | Tested? |
| --------------------------- | ----------: | ------: |
| Happy path                  |             |         |
| Validation                  |             |         |
| Boundary values             |             |         |
| Authentication              |             |         |
| Authorization               |             |         |
| Ownership                   |             |         |
| Tenant isolation            |             |         |
| Cross-tenant references     |             |         |
| State transitions           |             |         |
| Duplicate operation         |             |         |
| Idempotency                 |             |         |
| Database invariants         |             |         |
| Transaction rollback        |             |         |
| Concurrency                 |             |         |
| Optimistic locking          |             |         |
| Redis/cache                 |             |         |
| Rate limiting               |             |         |
| Outbox                      |             |         |
| PgBoss/job                  |             |         |
| External dependency failure |             |         |
| Error contract              |             |         |
| Information leakage         |             |         |
| Security middleware         |             |         |
| Audit logging               |             |         |
| Observability               |             |         |

"Not applicable" is acceptable only when the route genuinely does not involve that behavior.

---

# 75. Definition of Done

A route test task is NOT complete merely because tests pass.

The agent MUST confirm:

### Application path

* [ ] Test uses real `buildApp()`
* [ ] Test uses `app.inject()`
* [ ] Fastify lifecycle is exercised
* [ ] relevant hooks are exercised

### Input

* [ ] happy path
* [ ] missing values
* [ ] malformed values
* [ ] wrong types
* [ ] boundaries
* [ ] oversized input
* [ ] privileged fields

### Identity

* [ ] unauthenticated
* [ ] invalid authentication
* [ ] expired/revoked authentication where applicable
* [ ] correct authentication

### Authorization

* [ ] required permission
* [ ] insufficient permission
* [ ] ownership
* [ ] project-level permission where applicable
* [ ] stale permission/cache behavior where applicable

### Tenancy

* [ ] own tenant succeeds
* [ ] other tenant denied
* [ ] list endpoint does not leak other tenant
* [ ] foreign-key tenant escape prevented
* [ ] tenant spoofing prevented
* [ ] bulk operations tenant-scoped

### Business behavior

* [ ] business rules
* [ ] valid state transitions
* [ ] invalid state transitions
* [ ] terminal-state behavior
* [ ] duplicate behavior
* [ ] idempotency where applicable

### Database

* [ ] persistence verified
* [ ] relationships verified
* [ ] constraints verified
* [ ] transaction behavior verified
* [ ] rollback considered
* [ ] all assertion queries are scoped

### Async behavior

* [ ] outbox behavior
* [ ] event payload
* [ ] job creation
* [ ] retry/idempotency where applicable
* [ ] failure behavior
* [ ] stale-job behavior where applicable

### Infrastructure

* [ ] Redis/cache behavior where applicable
* [ ] Redis failure where applicable
* [ ] concurrency where applicable
* [ ] rate limiting where applicable
* [ ] timeout/body-limit behavior where applicable

### Security

* [ ] no IDOR
* [ ] no privilege escalation
* [ ] no tenant leakage
* [ ] no sensitive response leakage
* [ ] no sensitive log leakage

### Quality

* [ ] test is deterministic
* [ ] test is isolated
* [ ] test does not depend on ordering
* [ ] test name describes behavior
* [ ] no arbitrary sleeps
* [ ] no unnecessary mocks
* [ ] no unscoped aggregate assertions
* [ ] regression coverage added for bugs fixed

---

# 76. Mandatory Rules — Never Violate

An agent MUST NOT:

1. Replace `app.inject()` integration tests with mocked request/reply tests.
2. Remove randomized `runId` isolation.
3. Introduce global database truncation/reset without explicit architectural approval.
4. Add unscoped aggregate assertions.
5. Assert global row counts in an accumulating database.
6. Assert global absence such as "count is zero" without a test-specific scope.
7. Create fixture helpers that hide or omit tenant/resource scope.
8. Depend on another test having created required state.
9. Use arbitrary sleeps as the primary async synchronization mechanism.
10. Skip authorization because the happy path already authenticates.
11. Treat RBAC as equivalent to resource ownership.
12. Assume UUIDs eliminate IDOR.
13. Test only valid state transitions.
14. Test only HTTP responses when persistence/side effects are part of the behavior.
15. Ignore transaction rollback for multi-write operations.
16. Ignore duplicate events/requests when the operation can be retried.
17. Ignore concurrency where a business invariant can be violated.
18. Expose secrets or tokens in test output.
19. Silently modify unrelated testing infrastructure.
20. Claim a behavior is covered when the test does not actually exercise it.

---

# 77. Architectural Changes Require Explicit Approval

The following MUST NOT be changed as part of an ordinary route-test task:

### Database isolation strategy

Do not introduce:

```text
TRUNCATE
global reset
rollback-per-test
```

without explicit architectural approval.

### Integration architecture

Do not replace:

```text
real Fastify + app.inject()
```

with:

```text
handler + mocked request/reply
```

### Test identifier strategy

Do not remove:

```text
runId
```

randomization.

### Infrastructure strategy

Do not replace real PostgreSQL behavior with an in-memory substitute merely to make tests easier.

If the current architecture makes a category of test difficult, report the architectural limitation rather than silently changing the architecture.

---

# 78. Agent Workflow

When asked to add or modify tests for a route, follow this exact workflow.

## Step 1 — Read the route

Identify:

* HTTP method
* path
* params
* query
* body
* response
* hooks
* permissions
* service calls
* DB writes
* DB reads
* cache interactions
* events
* jobs
* state transitions
* transactions

---

## Step 2 — Read the implementation dependencies

Inspect:

```text
route
→ middleware
→ service
→ repository/query
→ transaction
→ cache
→ outbox/job
```

Do not design tests from the route file alone.

---

## Step 3 — Identify invariants

Write down what MUST always remain true.

Examples:

```text
resource belongs to exactly one organization
resource cannot cross project boundary
locked field log cannot be edited
completed project cannot return to active
duplicate pending approval cannot exist
stale project version cannot overwrite newer version
```

Every important invariant should have a test.

---

## Step 4 — Build the scenario matrix

Before coding, enumerate:

```text
happy
invalid
unauthenticated
unauthorized
wrong owner
wrong tenant
wrong state
duplicate
concurrent
dependency failure
transaction failure
async failure
```

Only applicable categories need implementation.

---

## Step 5 — Inspect existing fixtures

Find reusable fixtures.

Verify that fixture queries are properly scoped.

Do not blindly reuse a helper that performs an unscoped query.

---

## Step 6 — Implement integration tests

Use:

```text
real buildApp()
real app.inject()
real PostgreSQL
real relevant middleware
```

Use test doubles only at genuine external integration boundaries where necessary.

---

## Step 7 — Verify persistence and side effects

After mutation, inspect:

```text
DB
outbox
job
audit
cache
```

where applicable.

---

## Step 8 — Add failure tests

Intentionally exercise relevant failure paths.

---

## Step 9 — Add concurrency tests

Only where concurrency can affect correctness, but do not omit it merely because the normal sequential tests pass.

---

## Step 10 — Run regression tests

Run:

```text
new tests
related module tests
full integration suite
```

when practical.

---

## Step 11 — Review for false confidence
ouh
Before declaring success, ask:

```text
Could this pass while another tenant's data leaks?
Could this pass while duplicate processing occurs?
Could this pass while a transaction partially commits?
Could this pass while an event is lost?
Could this pass while stale permissions remain active?
Could this pass while two concurrent requests corrupt state?
Could this pass while sensitive data is leaked?
Could this pass because old test data accidentally satisfied the assertion?
```

If yes, the test suite is incomplete.

---

# 79. Final Test Quality Standard

The goal is not:

```text
"Does this endpoint return 200?"
```

The goal is:

```text
"Can this backend operation be trusted under
valid input, invalid input, hostile input,
wrong identity, wrong tenant, wrong state,
duplicate execution, concurrent execution,
database failure, cache failure, asynchronous
failure, and retry?"
```

A production-grade integration test proves the **system invariant**, not merely the HTTP response.

---

# 80. Quick Reference

Before writing any test, ask:

1. Am I testing through the real `buildApp()` and `app.inject()`?
2. What is the happy path?
3. What are every relevant validation boundary?
4. What happens without authentication?
5. What happens with invalid/expired authentication?
6. What permission is required?
7. What happens with insufficient permission?
8. Can another user access this resource?
9. Can another tenant access this resource?
10. Can the client spoof tenant identity?
11. Can a foreign resource ID be injected?
12. Can a foreign-tenant foreign key be supplied?
13. What are the valid state transitions?
14. What are the invalid state transitions?
15. What happens if the request is repeated?
16. Is the operation idempotent?
17. What database invariant must remain true?
18. What happens if a transaction fails halfway through?
19. Does this operation create an outbox event?
20. Is the outbox assertion scoped to this test?
21. Does it create a PgBoss job?
22. What happens if the job runs twice?
23. What happens if Redis is unavailable?
24. What happens if an external dependency times out?
25. Can two requests execute simultaneously?
26. Is optimistic locking involved?
27. Does the route affect cached authorization/data?
28. Does the route create an audit record?
29. Could the response leak sensitive information?
30. Could the logs leak sensitive information?
31. Does the test depend on previous tests?
32. Does any assertion query global accumulated state?
33. Am I using arbitrary sleeps?
34. Have I added a regression test for any bug being fixed?
35. Can this test pass while the actual production invariant is broken?

If any applicable question has no answer, the route test is not finished.
