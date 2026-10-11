# Phase 10: SaaS Billing & Subscription Management - Research

**Researched:** 2026-10-10  
**Domain:** Organization SaaS billing, subscriptions, entitlements, and Stripe integration  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- Book-a-demo sales/onboarding lead capture and scheduling — separate capability; does not provision the subscription trial and is outside the registered billing phase unless separately scoped.
- Additional currencies, metered overages, seat billing, AI credits, and multiple active subscriptions — not selected for the initial fixed organization plan; revisit with evidence and explicit product requirements.
- The named `.md` and `.docx` reference materials were not located in the repository; obtain them if their additional requirements are needed downstream.
</user_constraints>

## Summary

Use the existing Fastify modular monolith, PostgreSQL/Drizzle, shared Zod contracts, validated server environment, audit service, and PgBoss/outbox boundary; keep Stripe behind one server-side adapter rather than spreading provider calls across organization or construction-project modules. [VERIFIED: `apps/server/package.json:22-49`; `packages/database/src/schema/index.ts:1-22`; `packages/shared/src/index.ts:7-76`; `apps/server/src/app/index.ts:12-27,96-190`; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

Stripe's subscription states and webhook events are not a replacement for SiteFlow entitlement policy: Stripe documents multiple lifecycle states, no-card free trials, configurable missing-payment-method behavior at trial end, duplicate deliveries, and non-guaranteed event ordering. Keep PostgreSQL as the local authority and implement an independently durable webhook inbox/reconciliation path; neither a browser redirect nor a transient queue-deduplication window should grant entitlements. [CITED: `https://docs.stripe.com/billing/subscriptions/overview`; `https://docs.stripe.com/billing/subscriptions/trials`; `https://docs.stripe.com/webhooks`] [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:17-27,139-160,195-210`]

The source repository currently provides organization membership/RBAC and construction-finance entities, but its organization permission seed explicitly treats “Platform Admin” as a supra-organization concept rather than a seeded organization role. No current source evidence establishes a privileged platform-staff refund authorization; do not wire refunds to organization roles or the existing construction-payment permission without resolving that authorization gap. [VERIFIED: `apps/server/src/modules/rbac/permissions.seed.ts:54-60`; `apps/server/src/modules/rbac/permission.middleware.ts:13-35,51-69`; `packages/database/src/schema/invoice-payment.schema.ts:19-26,64-70,141-146,178-184`]

**Primary recommendation:** Plan an additive, organization-scoped billing domain with a local versioned catalog, a single current subscription invariant, server-side entitlement checks, a durable signed-webhook inbox, and separately audited billing records. Keep every exact plan/price, grace restriction, trial-eligibility rule, event allowlist, endpoint path, and refund permission unresolved until the cited source and user decision support it. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `packages/database/src/schema/commercial.schema.ts:19-35`; `apps/server/src/lib/outbox/outbox.service.ts:139-160`] [CITED: `https://docs.stripe.com/webhooks`; `https://docs.stripe.com/billing/subscriptions/overview`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Plan versions, subscription state, invoices, payment attempts, entitlement decisions | API / Backend and Database / Storage | — | The API owns policy; PostgreSQL is the user-selected authority for local state. Existing domain routes obtain an organization context from authenticated membership and check RBAC server-side. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `apps/server/src/modules/rbac/permission.middleware.ts:13-35`; `apps/server/src/modules/rbac/rbac.service.ts:17-40`] |
| Stripe API calls, hosted Checkout/Portal session creation, refunds if authorized | API / Backend | External provider | Keep provider calls in one adapter and outside database transactions; Stripe is the processor, not the browser's authority. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] [CITED: `https://docs.stripe.com/checkout/quickstart`; `https://docs.stripe.com/customer-management`] |
| Webhook authentication and inbox processing | API / Backend | Database / Storage; worker | Signature verification requires Stripe's raw unmodified request body; deduplication and retries need durable local state. [CITED: `https://docs.stripe.com/webhooks/signature`; `https://docs.stripe.com/webhooks`] |
| Billing dashboard actions and success/cancel presentation | Browser / Client | API / Backend | The browser may navigate to hosted Stripe UI and display local state, but a redirect is not an entitlement grant. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] [CITED: `https://docs.stripe.com/checkout/quickstart`; `https://docs.stripe.com/customer-management`] |
| Usage-limit enforcement | API / Backend and Database / Storage | — | Backend operations must make authorization and quota checks against Postgres state; Redis is not a billing correctness store. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `.planning/checklist_when_to_apply.md` §7] |

## Standard Stack

### Core

| Component | Current declared version / contract | Phase use |
|---|---|---|
| Fastify | `"fastify": "^5.2.1"` | Existing API and route/OpenAPI composition. [VERIFIED: `apps/server/package.json:31-49`] |
| Drizzle ORM | `"drizzle-orm": "^0.36.4"` | Additive PostgreSQL schemas, constraints, transactions, and migration generation. [VERIFIED: `apps/server/package.json:31-49`; `packages/database/package.json:22-32`] |
| PostgreSQL | Existing database is configured through validated `DATABASE_URL`; exact deployed server version is not established by the reviewed files. | Authority for billing state, webhook inbox, history, idempotency, and entitlement enforcement. [VERIFIED: `packages/env/src/server.ts:17-30`; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |
| Zod | `"zod": "^3.23.8"` | Shared request/domain validation and server environment validation. [VERIFIED: `apps/server/package.json:46-49`; `packages/env/src/server.ts:1-18`] |
| PgBoss | `"pg-boss": "^10.1.2"` | Existing workers for durable asynchronous processing; do not assume the current outbox's queue deduplication is a permanent inbox ledger. [VERIFIED: `apps/server/package.json:44-49`; `apps/server/src/worker-registration.ts:14-20`; `apps/server/src/lib/outbox/outbox.service.ts:17-27`] |
| Shared SiteFlow packages | Existing `@siteflow/database`, `@siteflow/env`, `@siteflow/shared`, `@siteflow/observability` workspace dependencies. | Follow existing schema barrel, shared-contract barrel, environment validation, logging, and tracing conventions. [VERIFIED: `apps/server/package.json:22-30`; `packages/database/src/schema/index.ts:1-22`; `packages/shared/src/index.ts:7-76`] |

### Supporting

| Component | Current evidence | Use |
|---|---|---|
| Stripe Node SDK candidate | Official docs list server-side SDKs; direct registry lookup returned `23.0.0`, published `2026-10-01`, and repository `github.com/stripe/stripe-node`. The legitimacy seam returned **SUS**, so all package-specific selection/install claims remain `[ASSUMED]` and require a `checkpoint:human-verify` before installation. [CITED: `https://docs.stripe.com/libraries`; `[ASSUMED]` registry observation; package-legitimacy check returned SUS] | If the human checkpoint clears it, keep it inside one adapter and use its signature-verification helpers. Do not hand-roll signature cryptography. [CITED: `https://docs.stripe.com/webhooks/signature`] |
| OpenAPI / Swagger | `@fastify/swagger` and Swagger UI are imported and registered by the current app. [VERIFIED: `apps/server/src/app/index.ts:9-10,96-156`] | Every new route must register Fastify schema metadata and match shared Zod runtime contracts. [VERIFIED: `apps/server/src/modules/reporting/exports/export.routes.ts:19-20,41-57`] |
| Audit service | `AuditService.log` accepts organization-scoped entries and an optional transaction. [VERIFIED: `apps/server/src/modules/audit/audit.service.ts:30-42`] | Audit lifecycle changes, refunds if implemented, and privileged denials without logging raw provider payloads or secrets. [VERIFIED: `apps/server/src/modules/audit/audit.service.ts:30-42`; `.planning/checklist_when_to_apply.md` §10] |
| Transactional outbox / worker registration | Existing outbox validates event envelopes and tenant scope; worker registration explicitly registers module workers. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:82-137,139-160`; `apps/server/src/worker-registration.ts:14-20`] | Reuse for outgoing internal work where its contract fits. Build a durable inbound provider-event inbox separately; the existing outbound outbox is not an inbound webhook ledger. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:139-160,195-210`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Stripe as the processor | No provider alternative evaluated; Stripe is locked in Phase 10 context. | Do not broaden provider scope during planning. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |
| PostgreSQL-backed local billing state | Redis or browser state | Not suitable as the authority under the user's locked decision; Redis remains an acceleration layer only. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `.planning/checklist_when_to_apply.md` §7] |

**Installation:** No package was installed during research. If the `stripe` package remains selected, first add a human verification checkpoint because the package-legitimacy seam returned SUS; only install an explicitly reviewed version afterward. [ASSUMED: candidate package selection pending the required checkpoint]

**Version verification:** Server dependencies observed in the manifest include `"fastify": "^5.2.1"`, `"drizzle-orm": "^0.36.4"`, `"pg-boss": "^10.1.2"`, and `"zod": "^3.23.8"`; Vitest is declared as `"vitest": "^3.0.0"`. [VERIFIED: `apps/server/package.json:22-49,65`]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `stripe` `[WARNING: package-legitimacy returned SUS; verify before using.]` | npm | Registry metadata reports creation `2011-09-28`; version `23.0.0` was published `2026-10-01`. These observations do not override the SUS gate. [ASSUMED: package remains unapproved under the package-name provenance rule] | Registry download API returned `23,474,299` for `2026-10-02` through `2026-10-08`; package-legitimacy seam had unknown download signals. [ASSUMED: package remains SUS despite this additional observation] | Registry metadata returned `github.com/stripe/stripe-node`; seam reported no repository signal. [ASSUMED: package remains SUS despite this additional observation] | **SUS** — seam reasons: unknown age, unknown downloads, no repository | Flagged — planner must add `checkpoint:human-verify` before installation. |

The source signals disagree: direct npm metadata/API returned an age, downloads, and repository, while the legitimacy seam returned unknown values and SUS. Preserve the SUS verdict; resolve the discrepancy before using the package. The registry response's `scripts.postinstall` value was null, which is not proof of package safety. [ASSUMED: install approval remains unresolved]

**Packages removed due to SLOP verdict:** none.  
**Packages flagged as suspicious SUS:** `stripe` — human verification checkpoint required before installation. [ASSUMED: package recommendation pending that checkpoint]

## Architecture Patterns

### System Architecture Diagram

```text
Organization user
    |
    | authenticated, organization-scoped request
    v
Fastify billing routes -----> shared Zod validation + Swagger schemas
    |                                  |
    v                                  v
Billing policy/service <------ organization context + current RBAC
    |
    +---- transaction: local catalog / subscription / invoice /
    |                   payment-attempt / entitlement history
    |                         |
    |                         +---- PostgreSQL (authority)
    |
    +---- Stripe adapter ----> hosted Checkout / Customer Portal
    |                              |
    |                              +---- user returns to browser (display only)
    |
    +<--- HTTPS webhook: raw-body signature verification
              |
              v
        Durable webhook inbox (unique event identity; tenant resolved locally)
              |
              v
        registered worker / reconciliation
              |
              +---- transaction: update local billing state + audit/outbox as needed
```

The existing side of the diagram is the Fastify app, authentication/RBAC, Postgres/Drizzle, Swagger, audit, outbox, and worker registration. [VERIFIED: `apps/server/src/app/index.ts:12-27,96-190`; `apps/server/src/modules/rbac/permission.middleware.ts:13-35`; `apps/server/src/modules/audit/audit.service.ts:30-42`; `apps/server/src/worker-registration.ts:14-20`]

The Stripe adapter, billing data, signed endpoint, inbox, and reconciliation boxes are recommended target architecture, not current runtime components. Their exact schema names, routes, event allowlist, worker schedule, and provider configuration remain undecided. [ASSUMED: target architecture proposal] [CITED: `https://docs.stripe.com/webhooks`; `https://docs.stripe.com/webhooks/signature`]

### Recommended Project Structure

Use the existing modular-monolith pattern: a server billing domain under `apps/server/src/modules/`, persistence additions under `packages/database/src/schema/` and generated Drizzle migrations, public validation under `packages/shared/src/modules/`, and environment additions under `packages/env/src/`. Register the new route plugin in `apps/server/src/app/index.ts` and the worker in `apps/server/src/worker-registration.ts`. These are integration locations, not final file names or API paths. [VERIFIED: `.planning/codebase/ARCHITECTURE.md`; `packages/database/src/schema/index.ts:1-22`; `packages/shared/src/index.ts:7-76`; `apps/server/src/app/index.ts:12-27,158-190`; `apps/server/src/worker-registration.ts:1-20`]

### Pattern 1: Local Catalog and Entitlement Authority

**What:** Store plan rules, immutable price versions, included-limit definitions, and the organization-to-provider reference mapping locally; treat Stripe Product/Price IDs as provider references. Construct Checkout on the server from a locally selected catalog version. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] [CITED: `https://docs.stripe.com/products-prices/how-products-and-prices-work`]

**When to use:** Every billing operation that creates/changes a subscription or checks entitlements. Persist the provider's invoice/payment state locally without making client-supplied amounts or identifiers authoritative. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

**Invariant:** Enforce one current subscription per organization with a database-backed uniqueness/locking rule once the product's precise definition of “active/current” is settled. Keep historical subscription and change records; never define uniqueness only in route code. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `.planning/checklist_when_to_apply.md` §2]

### Pattern 2: Signed Webhook Inbox and Reconciliation

**What:** Verify the exact unmodified raw request bytes before parsing/trusting the event; durably record the verified provider event ID before acknowledging; use a unique constraint for duplicate receipt; process effects asynchronously and idempotently; reconcile from the current provider object when delivery is missing or out of order. [CITED: `https://docs.stripe.com/webhooks/signature`; `https://docs.stripe.com/webhooks`; VERIFIED: `.planning/checklist_when_to_apply.md` §2, §9]

**Tenant mapping:** Resolve the organization using a server-held Stripe customer/subscription association. Do not use a client organization identifier, Checkout redirect, or unverified event metadata as authorization. Quarantine or explicitly handle events whose provider IDs cannot be mapped; do not guess tenant ownership. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `apps/server/src/modules/rbac/permission.middleware.ts:21-35`] [CITED: `https://docs.stripe.com/webhooks`]

**Retry boundary:** Stripe API idempotency protects retried outbound API mutations; webhook event-ID deduplication protects inbound deliveries; local business-operation idempotency protects concurrent SiteFlow requests. These are separate keys/invariants. [CITED: `https://docs.stripe.com/api/idempotent_requests`; `https://docs.stripe.com/webhooks`]

**Do not over-reuse:** The existing outbox sends local events out to PgBoss and uses a bounded 24-hour singleton window; that is not a durable billing-event inbox or permanent consumer ledger. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:17-27,139-160,195-210`; `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md` REM-04/REM-09]

### Pattern 3: Explicit Local Lifecycle Policy

Stripe documents distinct statuses including trialing, active, incomplete, past-due, unpaid, canceled, and paused; the API's status should be synchronized as provider state, then mapped through explicit SiteFlow policy. Do not collapse it into an `active` boolean or copy a generic Stripe example that revokes access immediately when this phase has a user-selected seven-day grace period. [CITED: `https://docs.stripe.com/billing/subscriptions/overview`; `https://docs.stripe.com/billing/subscriptions/webhooks`; VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

Stripe's no-card free trial can be `trialing`; behavior when no payment method exists at trial end is configurable. The planner must select an explicit expiry/conversion outcome consistent with requiring a fresh paid Checkout after trial, without accidentally allowing an automatic charge or treating a redirect as activation. [CITED: `https://docs.stripe.com/billing/subscriptions/trials`; `https://docs.stripe.com/billing/subscriptions/overview`; VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

### Anti-Patterns to Avoid

- **Granting from the return URL:** The browser's success/cancel redirect is presentation only; persist/grant from verified local policy and provider-backed state. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] [CITED: `https://docs.stripe.com/checkout/quickstart`]
- **Trusting event order:** Stripe does not guarantee delivery order; event ID dedup alone does not solve stale object updates. Fetch/reconcile authoritative current object state where needed. [CITED: `https://docs.stripe.com/webhooks`]
- **Treating queue singleton as permanent replay control:** The existing outbox sends PgBoss singleton options with a 24-hour window; add durable inbox identity and transaction-protected processing. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:22-27,139-160`]
- **Letting the Portal bypass local policy:** Portal features are configurable and customer actions may change billing settings/subscriptions. Configure only the agreed payment-method and invoice viewing capabilities; reconcile and restrict any subscription-changing flow to the approved server policy. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] [CITED: `https://docs.stripe.com/customer-management`]
- **Reusing project commercial invoice/payment tables:** Those records are project-scoped and have project/org foreign-key constraints; SaaS billing must remain a separate organization-level domain. [VERIFIED: `packages/database/src/schema/invoice-payment.schema.ts:19-26,64-70,141-146,178-184`; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Stripe signature verification | Custom HMAC/header parsing or verification against parsed/re-serialized JSON | Official Stripe SDK webhook verification helper after the SDK passes the package checkpoint; preserve raw bytes. | Stripe requires the unmodified raw request body for signature verification. [CITED: `https://docs.stripe.com/webhooks/signature`; package legitimacy audit above] |
| Stripe hosted billing UI | Custom card form/payment capture | Stripe-hosted Checkout and the configured Customer Portal. | These are explicitly selected and documented provider surfaces; local entitlements still come from persisted, verified state. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `[CITED: https://docs.stripe.com/checkout/quickstart; https://docs.stripe.com/customer-management]`] |
| Tax calculation and jurisdiction rules | Custom tax rates, jurisdiction lookup, or silent zero-tax fallback | Stripe Tax when enabled and configured for the relevant account/jurisdiction; fail explicitly when unavailable. | Tax applicability and registration are provider/account-specific; the product decision requires explicit handling rather than fabricated behavior. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `[CITED: https://docs.stripe.com/tax]`] |
| Webhook dedup/replay | In-memory `Set`, PgBoss singleton timeout, or a cache key | PostgreSQL inbox event identity, conditional state transitions, and durable idempotent worker behavior. | Process-local state resets; the existing outbox's queue singleton deduplication is bounded in time. [VERIFIED: `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md` REM-09; `apps/server/src/lib/outbox/outbox.service.ts:22-27`; `.planning/checklist_when_to_apply.md` §2] |
| Exact money arithmetic and invoice state | Floating-point arithmetic or construction-project invoice lifecycle reuse | Provider invoice/payment facts synchronized into separate billing records; use the repository's established exact-money conventions only where applicable. | Existing finance uses decimal/money helpers and project-scoped models; SaaS finance is explicitly separate. [VERIFIED: `apps/server/src/modules/project/commercial-summary/commercial-summary.service.ts:1-45`; `packages/database/src/schema/invoice-payment.schema.ts:19-26,141-146`; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |

**Key insight:** Stripe owns payment processing and provider object state; SiteFlow owns its plan versions, organization access rules, and local entitlement record. A provider status/event is an input to the local policy engine, not a direct permission check. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `[CITED: https://docs.stripe.com/billing/subscriptions/overview; https://docs.stripe.com/webhooks]`]

## Common Pitfalls

### Pitfall 1: Status-to-entitlement mismatch

**What goes wrong:** Stripe transitions among trial, incomplete payment, delinquency, pause, unpaid, and cancellation states while SiteFlow's user-selected grace and period-end rules remain separate. [CITED: `https://docs.stripe.com/billing/subscriptions/overview`; `https://docs.stripe.com/billing/subscriptions/webhooks`; VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

**How to avoid:** Define a reviewed transition table for provider status × local effective date × entitlement outcome before implementation; keep billing recovery/account access and data retention distinct from operational feature access. Exact status mapping and restriction matrix remain open. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

### Pitfall 2: Trial ends without payment method

**What goes wrong:** Stripe's missing-payment-method end behavior is configurable; a default or portal action can diverge from the explicit post-trial Checkout decision. [CITED: `https://docs.stripe.com/billing/subscriptions/trials`; `https://docs.stripe.com/billing/subscriptions/overview`]

**How to avoid:** Choose the provider/local trial representation and explicit trial-end behavior in planning; test expiry, payment action required, and explicit user-initiated conversion. Do not define trial eligibility enforcement beyond the confirmed one-per-organization/14-day/no-card decision. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

### Pitfall 3: Duplicate or out-of-order provider events

**What goes wrong:** Retries can repeat deliveries and event ordering is not guaranteed. [CITED: `https://docs.stripe.com/webhooks`]

**How to avoid:** Persist a unique provider event ID, make each state transition durable/idempotent, and fetch/reconcile current provider objects when an older event arrives after a newer state. Add replay and stale-event tests. [CITED: `https://docs.stripe.com/webhooks`; VERIFIED: `.planning/checklist_when_to_apply.md` §2, §9]

### Pitfall 4: Signature verification after JSON parsing

**What goes wrong:** Body mutation/serialization before signature verification invalidates verification. [CITED: `https://docs.stripe.com/webhooks`; `https://docs.stripe.com/webhooks/signature`]

**How to avoid:** Make the webhook route's raw-body handling explicit and test signed success, malformed/modified body, missing/invalid signature, and duplicate delivery through the actual Fastify stack. The reviewed app factory registers no raw-body webhook component today; verify parser behavior when implementing the endpoint. [VERIFIED: `apps/server/src/app/index.ts:1-27,35-93`; targeted source search for raw-body/webhook registration; `[CITED: https://docs.stripe.com/webhooks/signature]`]

### Pitfall 5: Hidden alternate mutation paths

**What goes wrong:** Customer Portal features, retries, or direct Stripe-side changes may bypass assumptions encoded only in SiteFlow UI. [CITED: `https://docs.stripe.com/customer-management`; `https://docs.stripe.com/billing/subscriptions/webhooks`]

**How to avoid:** Configure the Portal narrowly for the confirmed payment-method/invoice use, reconcile all implemented provider mutation paths, and test server-side authorization for every local state-changing route. Do not finalize portal subscription-change features until SiteFlow's policy is explicit. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `apps/server/src/modules/rbac/permission.middleware.ts:51-69`]

### Pitfall 6: Construction-finance cross-contamination

**What goes wrong:** A SaaS subscription/invoice/refund is represented as a project invoice/payment or acquires project workflow permissions and semantics. [VERIFIED: `packages/database/src/schema/invoice-payment.schema.ts:19-26,64-70,141-146,178-184`; `apps/server/src/modules/project/financial-summary/financial-summary.service.ts:53-80`; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

**How to avoid:** Keep billing schemas, permissions, audit actions, API contracts, and state transitions distinct; use project commercial modules only as conventions, never as the SaaS ledger. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `packages/database/src/schema/index.ts:1-22`]

## Code Examples

### Existing authenticated route and runtime-validation pattern

This excerpt is from the existing export route and illustrates the project convention; it is not a proposed billing URL. [VERIFIED: `apps/server/src/modules/reporting/exports/export.routes.ts:19-20,41-57`]

```ts
app.addHook('preHandler', authenticate);
app.addHook('preHandler', organizationContext);

const parsed = RequestExportBodySchema.parse(req.body);
```

### Stripe signature-verification call shape

Illustrative official SDK call shape only; preserve the original raw request bytes and keep the actual signing secret exclusively in protected runtime configuration. The names below are placeholders, not SiteFlow environment-variable names. [CITED: `https://docs.stripe.com/webhooks/signature`; package installation remains gated by the audit above.]

```ts
const event = stripe.webhooks.constructEvent(
  unmodifiedRawRequestBody,
  signatureHeader,
  configuredEndpointSecret,
);
```

### Transactional local state and event handoff

Use SiteFlow's transaction/outbox pattern for internal events when its schema contract fits; external HTTP calls must remain outside the database transaction. This is a pattern sketch, not an implementation or final event contract. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:139-160`; `.planning/checklist_when_to_apply.md` §8-9]

```ts
await db.transaction(async (tx) => {
  await persistLocalBillingState(tx, verifiedProviderFacts);
  await writeOutboxEvent(tx, eventType, tenantScopedPayload, organizationId);
});
```

## State of the Art

| Avoid | Prefer | Evidence / impact |
|---|---|---|
| Redirect success as payment confirmation | Verified provider state reconciled into PostgreSQL; browser return only displays local status. | Locked Phase 10 decision and Stripe subscription lifecycle docs. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `[CITED: https://docs.stripe.com/billing/subscriptions/overview]`] |
| One boolean for subscription access | Persist provider lifecycle facts and apply an explicit local transition/entitlement policy. | Stripe publishes multiple lifecycle states; grace and paid-period-end access are local requirements. [CITED: `https://docs.stripe.com/billing/subscriptions/overview`; VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |
| Event arrival order as state order | Idempotent inbox plus reconciliation/current-object retrieval when needed. | Stripe says event delivery order is not guaranteed and duplicates can occur. [CITED: `https://docs.stripe.com/webhooks`] |
| Stripe catalog IDs/amounts as product policy | Local versioned plan/price/entitlement authority with provider IDs as references. | User-locked catalog decision; Stripe separates Products and Prices. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `[CITED: https://docs.stripe.com/products-prices/how-products-and-prices-work]`] |

**Changed when:** These are current provider behaviors checked on 2026-10-10; the cited docs do not establish a single change date for these general design principles. [CITED: `https://docs.stripe.com/billing/subscriptions/overview`; `https://docs.stripe.com/webhooks`]

## Assumptions Log

| # | Claim / proposal requiring confirmation | Section | Risk if wrong |
|---|---|---|---|
| A1 | `stripe` SDK remains only a candidate: the legitimacy gate returned SUS despite separately observed npm metadata; human review is required before installation. | Standard Stack / Package audit | Supply-chain risk or wrong dependency choice. |
| A2 | A local-only trial record until explicit paid Checkout may be the simplest way to guarantee no automatic trial conversion; the product has not selected local vs Stripe trial representation. | Pattern 3 / Open Questions | Unexpected provider billing, duplicate trial state, or trial entitlement mismatch. |
| A3 | A durable inbox will need enough verified event data for replay/reconciliation, but payload minimization, retention, and access policy are not decided. | Pattern 2 / Security | Excess financial/PII retention or inadequate recovery evidence. |
| A4 | The precise 7-day grace start event/time, Stripe retry behavior during grace, and treatment of `past_due` versus `unpaid` need policy confirmation. | Pitfall 1 / Open Questions | Premature restriction or unintended continued access. |
| A5 | A dedicated platform-staff authorization mechanism may not exist; reviewed organization RBAC does not prove one exists elsewhere. | Refund authorization | Unauthorized refund capability or inability to provide refunds. |
| A6 | Portal configuration may permit subscription mutations unless explicitly restricted; the exact Dashboard feature setup is not inspected. | Pitfall 5 | Provider-side changes bypass policy or create unintended invoices. |
| A7 | Specific event allowlist, worker schedule, reconciliation cadence, event retention, and operational alerts are design proposals, not user-approved values. | Pattern 2 / Open Questions | Lost recovery, event overload, or undocumented retention. |
| A8 | Limit units, hard/soft behavior, and counting/reset semantics remain undecided even though limits are included in plans. | Open Questions | Incorrect entitlement decisions and concurrency anomalies. |
| A9 | The user's Stripe account, Dashboard Test Mode configuration, products/prices, portal settings, and webhook destination were not verified; no account credentials were accessed. | Environment Availability | Provider-backed acceptance cannot run until user setup is complete. |

## Decision Disposition

All ten research questions have an explicit controlling source or execution gate. Product values not locked in `10-CONTEXT.md` remain undecided; routing a question is not approval. No Stripe account was accessed and no provider acceptance is claimed.

| Question | Disposition | Controlling artifact / plan | Implementation effect |
|---|---|---|---|
| Q1 — Catalog names, prices, intervals, limits, and price-version policy | Deferred to the blocking human policy decision in Plan 10-02 | `10-CONTEXT.md` D-03/D-04; `10-02-PLAN.md` | Keep each value unset until explicitly approved; catalog implementation is blocked meanwhile. |
| Q2 — Trial representation and eligibility | Representation resolved by locked D-01/D-02: SiteFlow is authoritative for the no-card trial and paid Checkout is explicit; eligibility identity rules are deferred to Plan 10-02 | `10-CONTEXT.md` D-01/D-02; `10-02-PLAN.md`; `10-04-PLAN.md` | Do not create a provider-side trial or infer eligibility for deleted, merged, or recreated organizations; keep eligibility-dependent provisioning blocked pending decision. |
| Q3 — Provider/local lifecycle mapping, grace start, and retry behavior | Locked outcomes remain fixed by D-07/D-08; unspecified mappings and timings are deferred to the blocking human policy decision in Plan 10-02 | `10-CONTEXT.md` D-07/D-08; `10-02-PLAN.md` | Implement only the stated period-end and seven-day grace outcomes; hold any unspecified transition or timing until approved. |
| Q4 — Trial-expiry, grace, and restricted-access matrix | Deferred to the blocking human policy decision in Plan 10-02 | `10-CONTEXT.md` D-08/D-09; `10-02-PLAN.md` | Preserve account/billing recovery and customer data; do not implement other access restrictions without the approved matrix. |
| Q5 — Portal features and proration/lifecycle actions | Portal scope is resolved by locked D-15 (payment-method management and invoice viewing only); remaining upgrade/proration, cancellation, downgrade, and reactivation policy is deferred to Plan 10-02 | `10-CONTEXT.md` D-07/D-15; `10-02-PLAN.md`; `10-13-PLAN.md` | Keep Portal subscription mutations disabled; hold SiteFlow-owned edge behavior until policy approval. |
| Q6 — Webhook event set, endpoint path, unmatched IDs, and payload retention | Technical contract is derived only from implemented source and provider SDK semantics; Test Mode Dashboard endpoint/event setup is withheld until the blocking human setup/acceptance gate in Plan 10-10 | `10-07-PLAN.md`, `10-14-PLAN.md`, `10-10-PLAN.md` | No event allowlist or endpoint is represented as approved before code establishes it; quarantine unmatched IDs and minimize retained data; configure the Dashboard only against verified deployed behavior. |
| Q7 — Privileged refund authority | Implementation explicitly withheld until the existing supra-organization staff authority is verified in source/configuration | `10-17-PLAN.md`; `COVERAGE.md` | Persist verified refund history independently; expose no refund mutation unless the exact existing authority is evidenced and enforced. |
| Q8 — Stripe Tax account settings, registrations, and unsupported jurisdictions | Provider-specific Tax behavior is withheld until the user's account configuration and supported jurisdiction are verified at the Plan 10-10 blocking setup gate; product policy is not inferred | `10-16-PLAN.md`; `10-10-PLAN.md`; `10-CONTEXT.md` D-13 | Use Tax only when configured and enabled; fail explicitly when required configuration or jurisdiction support is absent; never infer a zero amount or exemption. |
| Q9 — Limit units, reset periods, consuming operations, and denial behavior | Deferred to the blocking human policy decision in Plan 10-02 | `10-CONTEXT.md` D-03/D-04; `10-02-PLAN.md`; `.planning/checklist_when_to_apply.md` §2 | Do not select units, reset rules, or consuming operations; enforce approved limits atomically in PostgreSQL only after decision. |
| Q10 — Stripe Test Mode account, catalog, Portal, ngrok, and Dashboard webhook setup | Withheld until the user completes the blocking human provider-setup checkpoint in Plan 10-10 | `10-CONTEXT.md` D-16/D-17; `10-10-PLAN.md` | Provider acceptance remains pending until setup and real signed Dashboard delivery are evidenced; no credentials are requested or exposed. |

**Acceptance disposition:** No un-routed open question remains. Human decisions in Plans 10-02 and 10-10 are genuine blocking gates, and the conditional source/setup branches above remain unimplemented until their stated evidence exists.

## Environment Availability

| Dependency | Required by | Available | Version / observation | Fallback |
|---|---|---|---|---|
| Node.js | Server/test runtime | Yes | `v22.13.1` | — [VERIFIED: command probe; root manifest declares `"node": ">=20.0.0"` in `package.json`] |
| pnpm | Workspace commands | Yes | `9.12.0` | — [VERIFIED: command probe; root manifest declares `"pnpm": ">=9.0.0"` in `package.json`] |
| Docker | Existing integration services | Yes | `Docker version 29.4.1, build 055a478` | Start the repository's documented local test services if authorized. [VERIFIED: command probe; `.planning/siteflow_testing_context.md` §4] |
| PostgreSQL test service | Server integration tests | No listener observed | `127.0.0.1:5434` probe returned `False` | Start the established dedicated test database before integration tests; do not replace with SQLite or in-memory persistence. [VERIFIED: port probe; `.planning/siteflow_testing_context.md` §4] |
| Redis test service | Current server test environment | No listener observed | `127.0.0.1:6379` probe returned `False` | Start existing Redis test service; billing correctness must remain PostgreSQL-backed. [VERIFIED: port probe; `.planning/siteflow_testing_context.md` §4; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |
| MinIO test service | Existing shared integration setup | No listener observed | `127.0.0.1:9000` probe returned `False` | Not a billing dependency unless the implementation introduces a justified artifact requirement. [VERIFIED: port probe; `.planning/codebase/INTEGRATIONS.md`] |
| ngrok | Public HTTPS callback for real Dashboard webhook acceptance | Command found | `ngrok` executable available; version probe returned no version text | User-selected tool; confirm version/configuration locally before provider E2E. [VERIFIED: command probe; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |
| Stripe CLI | Not required for the user-selected Dashboard delivery flow | Not found | `stripe MISSING` | Use real Test Mode API operations and signed Dashboard delivery through ngrok as selected; do not substitute fake-provider E2E. [VERIFIED: command probe; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |
| Stripe account / Test Mode configuration | Provider-backed E2E | Not verified | User will create/activate and configure it; no credentials were read or requested. | User completes the documented Test Mode setup before acceptance. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |

**Missing dependencies with no fallback:** A real Stripe Test Mode account/configuration is a required user-owned prerequisite for provider-backed acceptance. Local PostgreSQL is required for the repository integration suite. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `.planning/siteflow_testing_context.md` §4]

**Missing dependencies with fallback:** The Stripe CLI is absent but is not required for the user-selected Dashboard/ngrok webhook route; PostgreSQL/Redis/MinIO test services must be started rather than emulated. [VERIFIED: command probes; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `.planning/siteflow_testing_context.md` §4]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest declared as `"vitest": "^3.0.0"`; server test script is `"test": "vitest run"`. [VERIFIED: `apps/server/package.json:17,65`] |
| Config file | `apps/server/vitest.config.ts`; the config includes `tests/**/*.{test,spec}.ts`, excludes `tests/**/*.e2e.ts`, and uses `tests/setup.ts`. [VERIFIED: `apps/server/vitest.config.ts:1-12`] |
| Quick run command | `pnpm --filter @siteflow/server test` (server package script). [VERIFIED: `apps/server/package.json:14-18`] |
| Full suite command | `pnpm --filter @siteflow/server test`; phase gate additionally requires server lint/typecheck/build and focused/full workspace regression checks. [VERIFIED: `apps/server/package.json:14-20`; `.planning/checklist_when_to_apply.md` §12] |

### Phase Behaviors → Test Map

| Behavior | Test type | Automated / acceptance command | File exists? |
|---|---|---|---|
| Pure trial/grace/period-end entitlement decision table after policy confirmation | Unit, deterministic/offline | `pnpm --filter @siteflow/server test` | No billing-specific test established in the reviewed tree; add tests during implementation. [VERIFIED: `apps/server/package.json:17`; directory inventory of `apps/server/tests/unit/`] |
| Local catalog mapping, one-current-subscription invariant, idempotent transitions and limits under concurrency | PostgreSQL integration; real DB | `pnpm --filter @siteflow/server test` | New coverage required; use real PostgreSQL and `app.inject()` for route behavior. [VERIFIED: `.planning/siteflow_testing_context.md` §§2,4,30-39; `apps/server/vitest.config.ts:7-12`] |
| Auth/RBAC, wrong-organization isolation, refund privilege boundary, request/response/OpenAPI parity | Fastify/PostgreSQL integration | `pnpm --filter @siteflow/server test` | New coverage required; exact permissions and paths remain open. [VERIFIED: `.planning/siteflow_testing_context.md` §§2,15-25; `apps/server/src/modules/reporting/exports/export.routes.ts:41-57`] |
| Invalid signature/raw-body mutation, webhook duplicate replay, processing retry, stale/out-of-order update reconciliation | Unit for deterministic reducer policy plus real PostgreSQL integration; real Stripe Test Mode Dashboard/ngrok acceptance for provider signature/delivery | Server test suite plus manually gated real Test Mode acceptance after setup; no existing provider E2E script was found in the server package scripts. [VERIFIED: `apps/server/package.json:14-20`; `[CITED: https://docs.stripe.com/webhooks; https://docs.stripe.com/webhooks/signature]`] |
| Hosted Checkout, Portal payment-method/invoice view, subscription invoice/payment outcomes, Tax if enabled, and refund if authorized | Real Stripe Test Mode E2E; visible provider objects/deliveries in Dashboard | Real Test Mode operations through protected local configuration and signed webhook delivery via ngrok; exact command/URLs remain implementation-dependent. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `[CITED: https://docs.stripe.com/test-mode]`] |

**Sampling rate:** Unit tests per policy task; real PostgreSQL/Fastify integration tests per route/invariant task; provider-backed Test Mode and Dashboard/ngrok acceptance before provider behavior is claimed. [VERIFIED: `.planning/siteflow_testing_context.md`; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`]

**Wave 0 gaps:** No Stripe SDK/configuration/billing module was found in the targeted current-source scan; no billing test files exist in the reviewed module inventory. Add approved package/config/schema/route/inbox test scaffolding only after policy and package checkpoint. Local integration database and Redis are not running at research time. [VERIFIED: `apps/server/package.json:22-62`; `packages/env/src/server.ts:17-100`; `apps/server/src/app/index.ts:12-27,158-190`; command/port probes]

## Security Domain

### Applicable ASVS Categories

Use the current OWASP ASVS 5 category names below; these are applicable to this API/provider integration, not a claim of completed verification. [CITED: `https://github.com/OWASP/ASVS/tree/master/5.0/en`]

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Validation and Business Logic | Yes | Strict Zod validation, explicit lifecycle/limit transitions, replay-safe operations. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x11-V2-Validation-and-Business-Logic.md`; VERIFIED: `packages/shared/src/modules/project/payment-application.schema.ts:1-67`] |
| V4 API and Web Service | Yes | Authenticated organization routes, scoped persistence, runtime validation and OpenAPI parity. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x13-V4-API-and-Web-Service.md`; VERIFIED: `apps/server/src/modules/reporting/exports/export.routes.ts:19-57`] |
| V6 Authentication | Yes | Reuse existing authentication for organization user routes; provider webhook uses signature verification rather than end-user login. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md`; VERIFIED: `apps/server/src/modules/reporting/exports/export.routes.ts:41-42`; `[CITED: https://docs.stripe.com/webhooks/signature]`] |
| V7 Session Management | Yes | Protect billing routes with existing auth/session controls; do not treat hosted redirect parameters as a session or authorization. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x16-V7-Session-Management.md`; VERIFIED: `apps/server/src/modules/rbac/permission.middleware.ts:13-35`] |
| V8 Authorization | Yes | Scope all user-facing billing records and mutations to authenticated organization context; verify privileged staff refunds separately. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x17-V8-Authorization.md`; VERIFIED: `apps/server/src/modules/rbac/permission.middleware.ts:21-35,51-69`; `apps/server/src/modules/rbac/permissions.seed.ts:54-60`] |
| V11 Cryptography | Yes | Use Stripe's SDK verification helper; never hand-roll signature validation or print signing material. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x20-V11-Cryptography.md`; `https://docs.stripe.com/webhooks/signature`] |
| V12 Secure Communication | Yes | Register Dashboard webhook only as HTTPS; isolate Test/Live credentials and keep them in protected runtime configuration. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x21-V12-Secure-Communication.md`; VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |
| V13 Configuration | Yes | Centralize optional/required billing settings in Zod-validated server environment; never read ad hoc `process.env` or inspect `.env` while researching. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x22-V13-Configuration.md`; VERIFIED: `packages/env/src/server.ts:1-18`] |
| V14 Data Protection | Yes | Minimize provider event/customer data, redact credentials and avoid raw payment/provider payloads in logs. [CITED: `https://github.com/OWASP/ASVS/blob/master/5.0/en/0x23-V14-Data-Protection.md`; VERIFIED: `apps/server/src/app/index.ts:35-43`; `.planning/checklist_when_to_apply.md` §6, §10] |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Forged or altered webhook body | Spoofing / Tampering | Verify Stripe signature over the unmodified raw request body before parsing or processing. [CITED: `https://docs.stripe.com/webhooks/signature`; `https://docs.stripe.com/webhooks`] |
| Duplicate, replayed, or out-of-order event | Tampering / Denial of service | Unique durable event identity, idempotent transactions, bounded worker retries, current-object reconciliation, and observable quarantine/failure state. [CITED: `https://docs.stripe.com/webhooks`; VERIFIED: `.planning/checklist_when_to_apply.md` §2, §9] |
| Cross-organization access to billing records | Information disclosure / Elevation of privilege | Derive org scope from authenticated context; tenant-qualify every repository operation and test two organizations with `app.inject()`. [VERIFIED: `apps/server/src/modules/rbac/permission.middleware.ts:21-35`; `.planning/siteflow_testing_context.md` §§2,18-25] |
| Client-selected provider amount or entitlement | Tampering / Elevation of privilege | Resolve provider Price IDs from the local versioned catalog; ignore client amounts and redirects as authority. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `[CITED: https://docs.stripe.com/products-prices/how-products-and-prices-work]`] |
| Unauthorized staff refund | Elevation of privilege / Repudiation | Do not expose refund mutation without verified privileged staff authorization and separate audit; existing organization-level permission names do not establish supra-org staff authority. [VERIFIED: `apps/server/src/modules/rbac/permissions.seed.ts:54-60`; `apps/server/src/modules/audit/audit.service.ts:30-42`; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |
| Secret/PII leakage through logs, tests, diagrams, or errors | Information disclosure | Never read or print provider secrets; redact sensitive headers, store credentials only in protected runtime config, and log IDs/status rather than secrets/raw billing data. [VERIFIED: `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`; `apps/server/src/app/index.ts:35-43`; `.planning/checklist_when_to_apply.md` §6, §10] |
| Construction-finance record misuse | Tampering / Elevation of privilege | Separate SaaS tables and permission domain from project-scoped invoices/payments and project financial lifecycle. [VERIFIED: `packages/database/src/schema/invoice-payment.schema.ts:19-26,64-70,141-146,178-184`; `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md`] |

## Sources

### Primary — official project source and Stripe documentation

- `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-CONTEXT.md` — locked user decisions, discretion, deferred ideas, and provider test setup.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` — active phase scope and Phase 8 boundary.
- `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md` and `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md` — prior architecture/testing lessons and outbox/idempotency boundaries.
- `.planning/checklist_when_to_apply.md`; `.planning/siteflow_testing_context.md`; `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS,TESTING,CONVENTIONS,STRUCTURE,CONCERNS}.md` — required implementation/security/testing guidance and mapped conventions.
- `apps/server/package.json`; `apps/server/src/app/index.ts`; `apps/server/src/modules/{rbac,auth,audit,reporting}/`; `apps/server/src/lib/outbox/outbox.service.ts`; `apps/server/src/worker-registration.ts` — live application routing, authorization, audit, and async patterns.
- `packages/env/src/server.ts`; `packages/database/src/schema/{org,commercial,invoice-payment,outbox}.schema.ts`; `packages/database/src/schema/index.ts`; `packages/shared/src/{index.ts,events/domain-event.schema.ts,modules/project/payment-application.schema.ts}` — live environment, persistence, and shared contract patterns.
- Stripe Billing overview and status lifecycle — `https://docs.stripe.com/billing/subscriptions/overview`
- Stripe trial and missing-payment-method behavior — `https://docs.stripe.com/billing/subscriptions/trials`
- Stripe subscription webhook guidance — `https://docs.stripe.com/billing/subscriptions/webhooks`
- Stripe webhook signatures/raw-body, duplicate, and ordering guidance — `https://docs.stripe.com/webhooks/signature`; `https://docs.stripe.com/webhooks`
- Stripe hosted Customer Portal — `https://docs.stripe.com/customer-management`
- Stripe Products and Prices — `https://docs.stripe.com/products-prices/how-products-and-prices-work`
- Stripe idempotent API requests — `https://docs.stripe.com/api/idempotent_requests`
- Stripe Tax — `https://docs.stripe.com/tax`
- Stripe Test Mode — `https://docs.stripe.com/test-mode`
- OWASP ASVS 5 category source — `https://github.com/OWASP/ASVS/tree/master/5.0/en`

### Registry / package gate (not an approval)

- npm registry package metadata for `stripe` and npm downloads API were checked on 2026-10-10; the package-legitimacy seam returned **SUS**, so package name/version recommendations are not tagged verified and require human review before install.
- `ctx7` CLI and Context7 MCP were not available in this runtime; official documentation was inspected directly from Stripe's documentation site. No auto-install was attempted.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — manifests and source-of-truth files were opened; Stripe SDK remains SUS and uninstalled.
- Architecture: MEDIUM — grounded in live Fastify/RBAC/audit/outbox/schema sources plus locked Phase 10 decisions; new billing components are recommendations, not current runtime.
- Pitfalls: MEDIUM — Stripe primary docs were checked directly; account-specific Dashboard behavior and unresolved product policies remain open.

**Research date:** 2026-10-10  
**Valid until:** 2026-10-17; recheck Stripe documentation, registry/version metadata, package legitimacy, and Dashboard behavior before implementation.
