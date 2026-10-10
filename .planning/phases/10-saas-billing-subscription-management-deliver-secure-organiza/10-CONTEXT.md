# Phase 10: SaaS Billing & Subscription Management - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a secure, auditable organization-level SaaS subscription and entitlement backend inside SiteFlow's existing modular monolith. Stripe is the external commerce processor; PostgreSQL is the authoritative local record for subscription state, billing history, and entitlements. Keep this domain separate from construction project budgets, invoices, payment applications, and retainage. Reconcile the supplied billing brief with current repository source rather than treating its older stack/status descriptions as facts.

Phase 10 includes subscription plans and lifecycle, server-side entitlements/limits, provider integration, billing history, verified webhooks, appropriate billing routes and shared runtime validation, Swagger/OpenAPI, source-evidenced Archify diagrams, and the testing/quality gates in the canonical project checklist. The separate "book a demo" lead-generation/sales workflow is not trial provisioning and is deferred.

</domain>

<decisions>
## Implementation Decisions

### Plan Catalog and Trial Policy
- One 14-day, no-card trial per organization.
- After the trial, require an explicit paid checkout; do not silently charge or grant paid entitlements because of a browser redirect.
- Initial pricing is a fixed recurring price per organization with included limits. Exact tier names, amounts, included limits, trial eligibility enforcement details, billing intervals, and price-change policy remain for repository research/planning; do not invent them.
- SiteFlow owns plan rules and local price/version history. Stripe Product/Price identifiers are provider references associated with those versions, not client-authoritative amounts.

### Subscription Lifecycle and Access
- Permit one active subscription per organization while retaining historical subscription and change records.
- Downgrades and cancellations take effect at the end of the current paid period. Cancellation preserves paid access until its effective date.
- A confirmed failed renewal enters a 7-day grace period with reminders before access is restricted. Define the exact restricted-access matrix during research/planning; preserve essential account and billing recovery paths and do not delete customer data.
- Trial expiry, retry timing, payment-action-required, pause, reactivation, and upgrade/proration edge behavior must be reconciled with Stripe semantics and stated policy before implementation.

### Invoices, Payments, and Refunds
- Stripe generates SaaS subscription invoices; SiteFlow synchronizes provider invoice and payment-attempt state locally.
- Refund initiation is restricted to privileged SiteFlow billing staff; organization billing users cannot directly issue refunds. Reuse an existing platform-administration/authorization mechanism only if verified; do not assume one exists.
- A refund is a separately audited financial adjustment and does not itself cancel a subscription or revoke entitlements. Access follows the subscription policy.
- Use Stripe Tax when enabled for the account and reconcile tax amounts locally. Tax applicability/configuration and unsupported jurisdictions must fail explicitly rather than silently inventing tax behavior.
- SaaS invoices, collections, and refunds must not reuse construction-finance entities or lifecycle rules.

### Stripe Dashboard and Provider Testing
- Start in the user's US Stripe account, USD currency, and Test Mode. The user will create/activate the Stripe account and forward the local server through ngrok.
- Use Stripe-hosted Checkout. Enable Stripe Customer Portal for payment-method management and invoice viewing; subscription changes remain subject to SiteFlow's server-side policy and reconciliation.
- Register the eventual SiteFlow webhook route as an HTTPS destination in the Stripe Dashboard's Test Mode. Select only event types implemented and handled by the versioned webhook inbox; finalize endpoint path and event allowlist after source/research confirms the implementation contract.
- Exercise real Stripe Test Mode API operations and signed dashboard webhook deliveries through ngrok for integration/E2E acceptance so resulting test objects and deliveries are visible in the Stripe Dashboard. Keep pure domain unit tests deterministic/offline; do not claim those tests verify Stripe behavior.
- Never request or put Stripe API secrets or webhook signing secrets in chat, source, diagrams, test output, or commits. Store test/live secrets only in protected local/deployment environment configuration; separate test and live credentials.
- Before provider-backed tests can run, the user must create/activate the Stripe account, enable Test Mode, configure test products/prices after catalog policy is finalized, configure Customer Portal features, expose the local API through ngrok, and register the HTTPS webhook destination. Exact secret environment variable names, dashboard event list, and callback URL depend on implementation and must be documented after they are verified.

### Quality, Architecture, and Documentation
- Preserve the registered Phase 10 goal and success criteria in `.planning/ROADMAP.md`; Phase 8 remains pending and is not made complete by this work.
- Use the actual repository stack and conventions. Current package manifests/source show Fastify 5, TypeScript, Drizzle/PostgreSQL, Zod, PgBoss/transactional outbox, shared env validation, and Swagger; no Stripe SDK/configuration or SaaS billing module was found during this discussion's targeted scan.
- Share validation/contracts through existing Zod/shared-package patterns. New routes require runtime validation as well as Swagger/OpenAPI schemas, with matching request, response, and error shapes.
- Maintain Archify diagrams under `docs/architecture/`; draw only source-verified components/edges and keep SaaS billing distinct from project commercial/payment flows. Update diagrams as implementation changes rather than presenting planned edges as wired.
- Testing is mandatory at every applicable layer: pure unit tests for deterministic domain policy, real PostgreSQL/Fastify `app.inject()` integration tests for routes/tenant boundaries/transactions, and Stripe Test Mode end-to-end flows for provider behavior. Include failure, replay, out-of-order event, cross-tenant, concurrency, access-control, and recovery cases where applicable. Do not substitute SQLite, in-memory persistence, or mocked transaction behavior for the established integration environment.
- Apply `.planning/checklist_when_to_apply.md` per implementation chunk and at the phase gate, including bounded/indexed queries, transaction/locking/idempotency, server-side authorization, audit, OpenAPI parity, measured latency and PgBoss for costly work, migration/query-plan review, and focused/full regression checks.

### The agent's Discretion
- Research exact Stripe SDK/API semantics, current package/version support, and the smallest adapter/provider boundary consistent with the repository.
- Propose domain schemas, migration boundaries, Stripe event allowlist, idempotency/reconciliation mechanics, shared validation layout, and route paths after tracing actual conventions. Keep choices evidence-backed and return any policy-changing proposal to the user before locking it.
- Choose which behaviors merit pure unit versus real PostgreSQL integration versus Stripe Test Mode E2E based on the invariant under test. Provider-facing integration/E2E acceptance must use Stripe Test Mode, not a fake provider.
- Determine whether existing staff authorization supports privileged refund initiation; if it does not, identify the gap rather than inventing platform-admin privileges.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and prior decisions
- `.planning/ROADMAP.md` — Phase 10 goal, success criteria, and dependency; also preserves Phase 8 as pending.
- `.planning/PROJECT.md` — product boundaries, actual system context, and the previous Phase 8 platform-billing deferral (superseded only for this separately registered Phase 10).
- `.planning/REQUIREMENTS.md` — current requirements and prior billing deferral; Phase 10 requirement IDs/mapping are to be added during planning.
- `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md` — previous user decisions and the Phase 8 boundary; do not import its billing deferral into Phase 10.
- `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md` — recently verified authorization, tenant-scope, outbox, worker, and test lessons to preserve.

### Security, performance, testing, and architecture patterns
- `.planning/checklist_when_to_apply.md` — mandatory build-in security/performance/concurrency controls and phase-end quality gates.
- `.planning/siteflow_testing_context.md` — required route/integration testing architecture, real PostgreSQL policy, tenant isolation, rollback, worker, and failure-path standards.
- `.planning/codebase/STACK.md` — mapped stack and workspace package conventions; verify against live manifests.
- `.planning/codebase/ARCHITECTURE.md` — mapped modular-monolith, route, transaction, worker, and tenant boundaries; verify against live source.
- `.planning/codebase/INTEGRATIONS.md` — mapped current external integrations; verify current source and environment schema before adding Stripe.

### User-provided billing materials
- The Phase 02 billing specification in the user's command text — proposed model/API/event inventory, not proof of existing implementation; reconcile against repository source.
- `SiteFlow_Project_Operations_Context(1).md` and `SiteFlow_AI_Product_Specification_v2.docx` were named in the supplied text but were not found in the repository during this discussion. Request/locate the actual files before treating their contents as canonical.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/server/src/modules/reporting/exports/export.routes.ts` demonstrates Fastify plugin routes, `authenticate`/`organizationContext`, runtime Zod parsing, response envelopes, and per-route schema metadata.
- `apps/server/src/app/index.ts` registers `@fastify/swagger`/Swagger UI and domain route plugins; new billing routes must be explicitly registered.
- `packages/env/src/server.ts` centralizes Zod-validated server configuration and safe defaults; Stripe keys and URL/price configuration belong in validated env contracts, never ad hoc `process.env` reads.
- `apps/server/src/lib/outbox/outbox.service.ts` and `apps/server/src/worker-registration.ts` provide transactional event publishing and an explicit supported-worker registration surface. Current PgBoss singleton dedupe is bounded in time and must not be mistaken for a permanent consumer ledger.
- `packages/database/src/schema/` and the Drizzle migration tooling are the persistence pattern; inspect exports, FK/index conventions, and migration scripts before proposing billing tables.
- `apps/server/tests/integration/` uses a real Fastify app and PostgreSQL; `apps/web` exposes Playwright E2E scripts. Stripe Test Mode is needed in addition to these local layers to prove provider behavior.

### Established Patterns
- PostgreSQL/Drizzle is business-state authority; Redis is not a billing correctness store.
- Routes are domain-owned and composed into the modular Fastify app. Organization context/RBAC, audited mutations, shared response/error helpers, Zod validation, and tenant-qualified repositories are established patterns.
- External effects must not be performed inside database transactions. Persist pending state and durable work before asynchronous provider reconciliation.
- Existing project commercial entities implement construction finance and are explicitly outside SaaS subscription ownership.

### Integration Points
- New server-owned SaaS billing domain under `apps/server/src/modules/` with additive Drizzle schema/migrations under `packages/database/`.
- Shared request/response contracts in `packages/shared/`; validated Stripe configuration in `packages/env/`; explicit API registration in `apps/server/src/app/index.ts`; supported queue consumers in worker registration.
- Existing organization context/RBAC, audit service, transaction/outbox, PgBoss, OpenTelemetry/Pino, and test factories are integration boundaries to inspect and reuse.
- Swagger is served from the current Fastify app under `/docs`; verify schemas are registered for every billing route.
- Keep UI/Stripe redirects as presentation only; local persisted state and verified provider events govern entitlements.

</code_context>

<specifics>
## Specific Ideas

- User will create/use a US Stripe account in Test Mode and forward the local server port using ngrok.
- User wants provider-backed test events and Checkout activity visible in the Stripe Dashboard. No secret values will be sent in chat.
- "Book a demo" is a separate sales/onboarding capability, not the same thing as automatically provisioning a 14-day trial; preserve it as deferred work.
- The source specification is an input to reconcile, not a mandate to adopt its stale stack claims or every suggested table/event at once.

</specifics>

<deferred>
## Deferred Ideas

- Book-a-demo sales/onboarding lead capture and scheduling — separate capability; does not provision the subscription trial and is outside the registered billing phase unless separately scoped.
- Additional currencies, metered overages, seat billing, AI credits, and multiple active subscriptions — not selected for the initial fixed organization plan; revisit with evidence and explicit product requirements.
- The named `.md` and `.docx` reference materials were not located in the repository; obtain them if their additional requirements are needed downstream.

</deferred>

---

*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*
*Context gathered: 2026-10-10*
