# Phase 10: SaaS Billing & Subscription Management - Pattern Map

**Mapped:** 2026-10-10  
**Files analyzed:** 19 likely implementation artifacts (candidate locations; final names remain a planning choice)  
**Analogs found:** 14 / 19

## Scope and Evidence

Phase 10 is a backend-only addition to the existing Fastify modular monolith. The Stripe Dashboard is an external control panel, not a SiteFlow UI surface. Do not plan `apps/web` billing pages or treat a browser return URL as subscription or entitlement authority. No current SaaS billing module, Stripe SDK/configuration, Stripe webhook route, or raw-body webhook handler was found in tracked server source. Existing construction-finance invoices, payments, permissions, and lifecycle are not SaaS billing analogs to reuse.

The paths below are likely targets inferred from `10-CONTEXT.md` and `10-RESEARCH.md`; they are not claims that these modules already exist or that every proposed file is mandatory. Use actual policy decisions to settle table boundaries and route names.

Repository scope check: `.planning/STATE.md` still identifies Phase 8 as ready/pending, and the current roadmap keeps Phase 8 unchecked while separately registering Phase 10. This mapping creates only this PATTERNS.md; do not mark Phase 8 complete or alter its plans.

## File Classification

| New/Modified File (candidate) | Role | Data Flow | Closest tracked analog | Match Quality |
|---|---|---|---|---|
| `packages/database/src/schema/saas-billing.schema.ts` | model | CRUD, event-driven | `packages/database/src/schema/report-export.schema.ts`; `org.schema.ts`; `outbox.schema.ts` | role-match |
| `packages/database/src/schema/index.ts` | config | transform | Same schema barrel | exact |
| `packages/database/drizzle/<next-sequence>_<name>.sql` and `drizzle/meta/_journal.json` | migration | batch | `packages/database/drizzle.config.ts`; tracked migration SQL | role-match; sequence needs investigation |
| `apps/server/src/modules/billing/billing.routes.ts` | controller / route | request-response | `apps/server/src/modules/reporting/exports/export.routes.ts` | exact |
| `apps/server/src/modules/billing/billing.repository.ts` | model | CRUD | `apps/server/src/modules/reporting/exports/export.repository.ts` | role-match |
| `apps/server/src/modules/billing/billing.service.ts` and entitlement policy module | service / utility | CRUD, transform | `apps/server/src/modules/project/budget/budget.service.ts`; reporting `export.service.ts` | role-match |
| `apps/server/src/modules/billing/stripe.adapter.ts` | service | request-response | — | none |
| `apps/server/src/modules/billing/webhook.routes.ts` | route | event-driven | — | none |
| `apps/server/src/modules/billing/webhook-inbox.repository.ts` | model | CRUD, event-driven | — | none |
| `apps/server/src/modules/billing/webhook.worker.ts` | service | event-driven | `apps/server/src/modules/reporting/exports/export.worker.ts` | role-match for PgBoss only |
| `apps/server/src/app/index.ts` | config | request-response | Same Fastify app factory | exact |
| `apps/server/src/worker-registration.ts` | config | event-driven | Same worker registry | exact |
| `packages/shared/src/modules/billing/*.schema.ts` | utility / contract | transform | `packages/shared/src/modules/project/payment-application.schema.ts` | role-match |
| `packages/shared/src/index.ts` | config | transform | Same shared-package barrel | exact |
| `packages/env/src/server.ts` | config | transform | Same validated server env schema | exact |
| `apps/server/tests/unit/billing/*.test.ts` | test | transform | `apps/server/tests/unit/commercial/commercial_sod_policy.test.ts` (test structure only) | role-match |
| `apps/server/tests/integration/billing/*.test.ts` | test | request-response, CRUD | `apps/server/tests/integration/reporting/export-lifecycle.test.ts` | role-match |
| Provider-backed Test Mode acceptance (runner or documented acceptance procedure; location TBD) | test | request-response, event-driven | — | none |
| Source-evidenced Archify billing diagram(s) under `docs/architecture/` | config / documentation | transform | — | none among tracked files |

## Pattern Assignments

### Database schema, schema barrel, and migration

**Analogs:** `packages/database/src/schema/report-export.schema.ts` (lines 1-47), `packages/database/src/schema/org.schema.ts` (lines 65-94), `packages/database/src/schema/outbox.schema.ts` (lines 1-33), `packages/database/src/schema/index.ts` (lines 1-24).

Use the same `app` PostgreSQL schema, Drizzle `pgSchema`/`table` declarations, explicit status enums where the approved state machine warrants them, generated select/insert types, and schema barrel export. `report-export.schema.ts` is a good example of domain-specific lifecycle columns and query indexes:

```ts
const appSchema = pgSchema('app');

export const reportExportStatusEnum = appSchema.enum('report_export_status', [
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
  'EXPIRED',
]);

export const reportExports = appSchema.table(
  'report_exports',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    status: reportExportStatusEnum('status').notNull().default('PENDING'),
  },
  (t) => [
    index('report_exports_org_idx').on(t.organizationId),
    index('report_exports_status_idx').on(t.organizationId, t.status),
  ],
);
```

`org.schema.ts:89-94` demonstrates an actual FK to `organizations.id`. For billing, explicitly choose FK deletion behavior so organization cleanup cannot erase billing history in conflict with the phase's retention requirement. Add FKs and indexes for every FK and common organization/provider/status lookup; the report-export schema is not a complete FK template. Avoid mixing SaaS records into `invoice-payment.schema.ts` or other construction-finance tables.

Put the new schema export in `packages/database/src/schema/index.ts`, following the existing `.js` specifier convention. Enforce the one-current-subscription invariant in PostgreSQL (unique/partial-unique constraint and/or a locked authoritative row) after the meaning of “active/current” is decided. Keep historical subscriptions and price versions; do not rely on route-only validation. Do not invent plan values, price amounts, interval or limit semantics.

**Migration tooling:** `packages/database/drizzle.config.ts:1-17` declares `./src/schema/*.schema.ts`, output `./drizzle`, PostgreSQL dialect, schema filter `app`, and strict generation. `packages/database/package.json` supplies `db:generate` and `db:migrate`. Existing tracked SQL is a migration artifact, not permission to hand-number the next migration without checking metadata.

**Important live-tree discrepancy:** tracked `0040_notifications.sql` and `0041_notification_preferences.sql` exist, while the tracked `drizzle/meta/_journal.json` currently ends at tag `0039_financial_summary_indexes` (line 282). Reconcile the journal and actual database migration state before generating or applying a new migration. Do not assume the next sequence number or silently edit migration history. Review generated SQL, FK/indexes, constraints, rollback/forward behavior, and run `db:generate` plus `db:migrate` against a fresh PostgreSQL database as the phase gate requires.

### Organization billing routes and OpenAPI

**Analog:** `apps/server/src/modules/reporting/exports/export.routes.ts:1-74`, with schema metadata from `apps/server/src/modules/reporting/docs/export.api.schemas.ts:1-86`.

The route module pattern imports a Fastify plugin type, runtime schema, auth/context hooks, service, response helper, and endpoint OpenAPI schema. It attaches authentication before organization context and parses input at runtime:

```ts
export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', organizationContext);

  app.post('/:organizationId/exports', { schema: requestExportSchemaDoc }, async (req, reply) => {
    const parsed = RequestExportBodySchema.parse(req.body);
    const organizationId = req.params.organizationId;
    const result = await exportService.requestExport({ organizationId, /* validated values */ });
    return reply.status(202).send(createSuccessResponse(result));
  });
};
```

For new billing APIs, import the shared Zod contracts rather than leaving authoritative request shapes private to a route. Validate params, body, and query at runtime; define matching Fastify `schema` metadata for params/body/querystring and every success/error response. The export docs schema shows the project convention for `{ success, data }` and `{ success: false, error }` responses and per-status response declarations. Preserve the global machine-readable error shape through `createSuccessResponse`/`createErrorResponse` and typed domain errors; do not return raw Stripe errors, constraint names, payloads, or credentials.

`organizationContext` in `apps/server/src/modules/rbac/permission.middleware.ts:13-35` derives membership from authenticated user plus organization path parameter. Never accept the tenant as trusted body/query input. Add an explicit permission guard for every state-changing organization action; `authenticate` + `organizationContext` alone does not establish billing capability. Verify the permission names/role grants in the live RBAC maps rather than assuming a “billing admin” exists.

### Repository, lifecycle policy, transactions, and audit

**Analogs:** `apps/server/src/modules/reporting/exports/export.repository.ts:1-67`, `apps/server/src/modules/project/budget/budget.service.ts:148-180`, and `apps/server/src/modules/audit/audit.service.ts:30-42`.

`ExportRepository.findById` composes record ID with trusted `organizationId`; use that tenant-qualified lookup shape for all org-owned subscriptions, invoices, payment attempts, and customer/provider associations. Return a safe not-found result for cross-tenant IDs. Do not expose provider identifiers or internal payloads unnecessarily in DTOs.

For a state-changing read/modify/write, the budget service opens a Drizzle transaction and locks the controlling row with an organization predicate before evaluating state:

```ts
return this.db.transaction(async (tx) => {
  const [project] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
    .for('update');
  if (!project) throw new ProjectBudgetNotFoundError();
  // Read/validate and persist the related state using this same tx.
});
```

Apply the transaction/lock/unique-constraint pattern to billing transitions and concurrent checkout/subscription creation, but do not copy construction-budget behavior as SaaS policy. The phase checklist requires atomic multi-table writes, `FOR UPDATE` for guarded transitions, database uniqueness for “one per organization,” retry-safe idempotency, short transactions, and real concurrency tests. Never call Stripe, Redis, HTTP, or email from inside a database transaction. Stripe mutations need a stable outbound API idempotency key; local business-operation idempotency and inbound webhook event-ID dedupe are separate invariants.

`AuditService.log(entry, tx?)` accepts the optional transaction and passes it to its repository (`audit.service.ts:30-42`). Audit local billing lifecycle changes in the same transaction where atomicity is required, with `organizationId`, actor/action/resource and minimal safe metadata. Refund initiation requires a separate audit record, but must not be exposed unless an actual supra-organization staff authorization mechanism is verified. `permissions.seed.ts:54-60` explicitly excludes “Platform Admin” from organization roles as a supra-org concept; no tracked source analog establishes refund-staff authorization. Do not grant that authority to organization billing users or construction-payment roles.

Keep plan/price rules and entitlement decisions locally authoritative. Provider amounts/IDs are references, not client inputs. Preserve historical invoices, payment attempts, subscription changes and refund adjustments separately from construction-finance state. A refund is not itself a cancellation or entitlement revocation.

### Stripe adapter and verified webhook ingress

**Analog:** none for provider adapters or inbound webhooks. `apps/server/src/lib/outbox/outbox.service.ts` is only a *partial conceptual* analog for durable asynchronous event handling; it is an outbound local-event outbox, not a Stripe inbox or signature-verification implementation.

The current Fastify app has no registered raw-body webhook support. Do not assume the JSON parser preserves request bytes: create a route-scoped raw-body handling strategy and verify the exact unmodified bytes before JSON interpretation. Webhook authentication is Stripe signature verification, not user authentication or `organizationContext`. Use the Stripe SDK verification helper only after the package checkpoint clears; research recorded a **SUS** package-legitimacy verdict for `stripe`, so the planner must add human verification before installing it. Never hand-roll signature verification. Exact env names, API versions, endpoint path and event allowlist remain undecided.

Webhook handler flow to implement (not existing code):

1. Preserve raw bytes and validate the signature using a protected endpoint secret.
2. Durably insert the verified provider event identity into a PostgreSQL inbox with a unique event ID before acknowledging delivery.
3. Resolve organization only from server-held provider-customer/subscription associations. Do not trust browser redirects, client organization IDs, or unverified metadata to select tenant ownership; quarantine unmapped provider references rather than guessing.
4. Hand off durable work and process idempotently. Reconcile current provider objects when events are duplicated or stale/out of order; arrival order is not state order.
5. Commit local subscription/invoice/payment state and required audit/outbox changes atomically; keep external Stripe calls outside transactions.

The existing outbox uses PgBoss singleton dedupe for only 24 hours (`outbox.service.ts:17-27`) and thus is not a permanent inbound event ledger. Its publisher also has different direction and retry semantics. Do not substitute an in-memory `Set`, cache key, outbox row, or queue singleton window for a durable inbox.

### PgBoss worker and registration

**Analogs:** `apps/server/src/modules/reporting/exports/export.worker.ts:61-104` and `apps/server/src/worker-registration.ts:1-22`.

The export worker registers a bounded tenant-aware job (`tenantIdExtractor: data => data.organizationId`), scopes record reads to organization, safely skips terminal/already-finished records, and reloads current membership before privileged work. Use that as a worker skeleton: include `organizationId` in tenant job payloads, scope every database query, make repeated deliveries harmless, revalidate relevant current authorization/state, log safe identifiers, and control worker concurrency/timeouts. Do not confuse worker-side generic idempotency with the durable webhook event ledger.

Register each supported billing consumer explicitly in `registerWorkers`; an implementation under a module directory is dormant until that registry imports and calls it. The registered worker analog also shows schedules are declared explicitly there. Choose reconciliation/cleanup schedules only after the policy and event contract are selected; do not copy the export cron cadence as a billing requirement.

### Shared Zod contracts and server environment

**Analogs:** `packages/shared/src/modules/project/payment-application.schema.ts:1-67`, `packages/shared/src/index.ts:1-78`, and `packages/env/src/server.ts:1-18,80-104`.

The shared contract pattern uses bounded, trimmed IDs/text, strict field shapes, `.max()` collection limits, `.refine()` cross-field uniqueness, explicit query limits, and inferred TypeScript types:

```ts
const id = z.string().trim().min(1).max(128);

export const listPaymentApplicationsQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPaymentApplicationsQuery =
  z.infer<typeof listPaymentApplicationsQuerySchema>;
```

Use this only as a Zod design idiom; payment-application contracts and its project-finance lifecycle are not SaaS billing models. Export new shared billing schemas from `packages/shared/src/index.ts` using the existing `.js` path convention. Keep input contracts distinct from response DTOs; never accept an amount, Stripe price ID, organization ID, or entitlement as client authority.

`packages/env/src/server.ts` centralizes variables through `createEnv`, Zod validation/defaults, and `runtimeEnv: process.env`. Add billing configuration there (and update `.env.example` with placeholders only if required by implementation); no ad hoc `process.env` reads from billing modules. Exact Stripe variable names and optional/required-by-environment behavior are not finalized. Keep Test and Live credentials distinct and out of source, errors, tests, diagrams and logs. Fail explicitly when required provider/tax config is unavailable; do not silently substitute zero tax or a different account/mode.

### App registration, error behavior, and OpenAPI parity

**Analogs:** `apps/server/src/app/index.ts:12-27,96-156,158-185`, `apps/server/src/middleware/error-handler.ts:12-105`, and `apps/server/src/modules/reporting/docs/export.api.schemas.ts:14-86`.

`app/index.ts` imports route plugins, registers Swagger before route mounting, installs the central error handler before routes, then explicitly registers route plugins with `/api/v1/...` prefixes. Add billing API plugin imports/registration and tags there; a file in `modules/billing` is not live until wired. Keep that registration separate from any webhook plugin so its raw-body/parser scope can be intentionally configured.

Fastify uses route JSON-schema objects for Swagger. The export route-doc analog declares params/body plus explicit `202`, `200`, and standardized error responses. New JSON-schema documentation must match the imported shared Zod runtime contracts, response DTOs, status codes, and error codes. Verify generated `/docs` output and exercise each endpoint; do not assume runtime Zod validation automatically supplies accurate Swagger schemas.

The central error handler maps Zod/Fastify validation and `AuthError` to stable codes and hides stack traces in production. Provider errors need explicit safe domain mapping: never allow raw request bodies, provider payloads, signature headers/secrets, or SDK error objects to become public response details or unredacted structured logs.

### Tests: deterministic policy, PostgreSQL/Fastify, provider acceptance

**Analogs:** `apps/server/tests/unit/commercial/commercial_sod_policy.test.ts:1-65` (unit test structure only), `apps/server/tests/integration/reporting/export-lifecycle.test.ts:1-110,278-305`, `apps/server/tests/integration/outbox/transactional-publishing.test.ts:1-105`, and `apps/server/tests/helpers/test-app.ts:1-39`.

- **Pure unit tests:** Keep trial/grace/cancellation/limit policy tests deterministic and offline once product policy has been approved. Follow Vitest's `describe`/scenario assertions; test status/effective-time decision tables and forbidden transitions without claiming to verify Stripe. Test exact limit units/concurrency separately at the database layer.
- **Route/database integration:** `createTestApp()` calls the real `buildApp()`, awaits `app.ready()`, and tests use `app.inject()`. Follow the two-real-organizations test setup and persisted-state/audit assertions in `export-lifecycle.test.ts`. Add tenant A/B read/write denial, unauthorized action, malformed input, response/OpenAPI parity, duplicate checkout, simultaneous subscription creation, transition concurrency, audit atomics, rollback, and inbox replay/out-of-order cases. Use the established real PostgreSQL test service; do not replace it with SQLite, in-memory stores, or mocked transaction behavior.
- **Transactional/event tests:** `transactional-publishing.test.ts` wraps event writes in `db.transaction`, checks tenant matching, duplicate IDs and rollback. Scope assertions to this test's event/resource/org ID rather than global row counts. For a new inbox, test successful signed raw-body handling through Fastify, invalid/missing signature, body mutation, unique event replay, processing retry, unknown provider mapping, and no partial local state/audit/outbox on rollback.
- **Workers:** Add dedicated worker tests for retries, at-least-once duplicate execution and tenant scope; keep route enqueue assertions separate where running a full worker would make a route test nondeterministic. Use real database behavior for business invariants.
- **Stripe provider acceptance:** Pure units and DB integration do not prove provider behavior. Acceptance must exercise real Stripe Test Mode API operations and signed Dashboard deliveries through the user-configured HTTPS/ngrok endpoint; retain visible Dashboard objects/deliveries. User setup (account, Test Mode products/prices, Portal, ngrok, endpoint) is a prerequisite. Keep secrets protected and never print them. The current `apps/server/vitest.config.ts:7-12` excludes `tests/**/*.e2e.ts`, and the server package has no Stripe E2E script; any provider harness/run procedure must be explicitly wired/documented rather than silently assumed to run in the default Vitest command.

### Archify / architecture artifacts

**Analog:** no tracked architecture diagram source found under `docs/architecture/`. Files present on disk there are not tracked source according to `git ls-files`, so they are deliberately not cited or proposed as copy-from analogs.

Create/update diagrams only as the backend pieces become source-verified. Show Stripe Dashboard/provider as external, keep project commercial flows separate, and label only registered routes, validated config, committed tables, and registered workers as wired. Do not draw a planned adapter, inbox, refund path, or frontend as if already active. Keep credentials, webhook secrets, customer data, and test output out of diagrams. If the repository's Archify source format is not tracked/verified by planning time, surface that as a tooling/source-location question instead of copying a generated or ignored artifact.

## Shared Patterns

### Organization authority and RBAC

**Source:** `apps/server/src/modules/rbac/permission.middleware.ts:13-35,51-69`; `apps/server/src/modules/rbac/permissions.seed.ts:54-60`  
**Apply to:** Organization-facing catalog/subscription/history/Checkout/Portal routes.

Authenticate, establish organization context from the route organization parameter and RBAC membership, then require an approved server-side billing permission on each mutation. Derive actor and tenant from `request.user`/`request.orgContext`; never from request body or provider metadata. A webhook uses signature verification rather than user auth. Refunds remain blocked pending verified supra-org staff authorization; the organization permission seed explicitly does not define Platform Admin.

### Database correctness and tenant boundaries

**Sources:** `apps/server/src/modules/project/budget/budget.service.ts:148-170`; `apps/server/src/modules/reporting/exports/export.repository.ts:1-67`; `.planning/checklist_when_to_apply.md` §§2, 4, 8.  
**Apply to:** All persistent billing mutations, queries, uniqueness rules and entitlement checks.

Include organization scope in every tenant-owned repository predicate; transact all multi-table state changes; lock controlling rows for read-modify-write; enforce unique business invariants in PostgreSQL; keep transactions short and external I/O outside. Add indexes/FKs and bound all list queries. PostgreSQL is billing correctness authority; Redis is not.

### Event, worker and audit boundaries

**Sources:** `apps/server/src/lib/outbox/outbox.service.ts:139-180,193-244`; `apps/server/src/modules/audit/audit.service.ts:30-42`; `apps/server/src/worker-registration.ts:14-22`.  
**Apply to:** Domain events, asynchronous reconciliation, lifecycle/refund auditing.

For internal domain events, write `writeOutboxEvent(tx, ...)` with the primary state in the same transaction. Preserve tenant ID in queued payloads and register workers explicitly. Audit financial state changes with organization and actor context and avoid raw provider/PII payloads. The outbound outbox contract is not a substitute for the separately durable inbound Stripe inbox.

### Contract, error, and secret handling

**Sources:** `packages/shared/src/modules/project/payment-application.schema.ts:1-67`; `packages/env/src/server.ts:1-18,80-104`; `apps/server/src/middleware/error-handler.ts:44-105`.  
**Apply to:** All new APIs, config and provider-facing operations.

Share Zod request/response contracts, use runtime validation plus explicit Swagger schemas, stable domain error codes and the common response envelope. Put all provider configuration in validated env; redact secrets and minimize structured logs. Never treat a successful browser redirect as payment confirmation or grant/revoke access directly from a provider status without local lifecycle policy.

## No Analog Found

| File / behavior | Role | Data Flow | Reason / planner action |
|---|---|---|---|
| `apps/server/src/modules/billing/stripe.adapter.ts` | service | request-response | No tracked payment-provider adapter; keep provider calls behind this boundary and clear the human package verification checkpoint before SDK install. |
| `apps/server/src/modules/billing/webhook.routes.ts` | route | event-driven | No tracked signed-webhook route or raw-body implementation. Design raw-byte capture and signature verification explicitly; do not copy a JSON-parsed route. |
| `apps/server/src/modules/billing/webhook-inbox.repository.ts` | model | CRUD, event-driven | No inbound durable provider inbox; the existing outbox is outbound and has bounded queue dedupe. Design unique provider event identity and replay-safe state in PostgreSQL. |
| Provider-backed Test Mode acceptance harness/procedure | test | request-response, event-driven | No Stripe-backed tests or configured provider credentials; use real Test Mode/Dashboard/ngrok after user setup, not a fake provider. |
| Tracked Archify diagram source | config / documentation | transform | No architecture diagram file under `docs/architecture/` is currently git-tracked; locate/verify the canonical source format before diagram work. |
| Privileged refund authorization | middleware / policy | request-response | No verified supra-organization billing-staff authorization. Do not ship an organization-user refund path or invent a platform role. |

## Metadata

**Analog search scope:** `apps/server/src/modules/{reporting,rbac,audit,project}`, `apps/server/src/{app,lib,outbox,worker-registration.ts,middleware}`, `apps/server/tests/{unit,integration,helpers}`, `packages/{database,env,shared}`, and tracked `docs/architecture` paths.  
**Tracked-source gate:** Every named source analog above was checked with `git ls-files`; no ignored/untracked diagram artifact is used as an analog.  
**Project guidance:** Root `copilot-instructions.md` and `.github/skills/` / `.agents/skills/` were absent.  
**Files scanned:** 19 candidate implementation artifacts; existing source scan found no wired SaaS billing or Stripe implementation.  
**Pattern extraction date:** 2026-10-10.
