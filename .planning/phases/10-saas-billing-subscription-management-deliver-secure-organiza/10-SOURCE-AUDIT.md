# Phase 10 — Source Coverage Audit

All registered Phase 10 scope is assigned to executable plans. The user-decision identifiers below provide a traceable index to `10-CONTEXT.md`; they do not add or revise decisions.

## User-decision index

| ID | Canonical decision from `10-CONTEXT.md` | Plan coverage |
|---|---|---|
| D-01 | One no-card 14-day trial per organization | 10-02, 10-04 |
| D-02 | Explicit paid hosted Checkout after trial; redirects never grant paid entitlement | 10-02, 10-04, 10-12 |
| D-03 | Fixed recurring organization price with included limits | 10-02, 10-05 |
| D-04 | Do not invent plan names, prices, limits, intervals, or price-change policy | 10-02, 10-05, 10-11 |
| D-05 | SiteFlow owns plan/price versions; provider identifiers are references | 10-05, 10-12 |
| D-06 | One current subscription per organization with history | 10-04, 10-05, 10-07 |
| D-07 | Downgrade/cancel at paid-period end; retain access through effective date | 10-02, 10-09, 10-18 |
| D-08 | Confirmed failed renewal has seven-day grace and reminders; preserve account/billing recovery and data; exact reminder channel/provider requires user approval | 10-02, 10-09, 10-11, 10-19 |
| D-09 | Do not invent restricted-access matrix | 10-02, 10-11, 10-19 |
| D-10 | Stripe generates SaaS invoices; SiteFlow synchronizes invoice/payment-attempt state | 10-08, 10-14, 10-15 |
| D-11 | Refund mutation requires verified privileged SiteFlow staff authority | 10-17 |
| D-12 | Refund is separately audited and does not itself cancel/revoke access | 10-17 |
| D-13 | Stripe Tax only when enabled/configured; fail explicitly otherwise | 10-16 |
| D-14 | SaaS billing is separate from construction finance | 10-05, 10-08, 10-10, 10-15, 10-17 |
| D-15 | Stripe-hosted Checkout and Portal; Portal only payment methods/invoice viewing | 10-12, 10-13 |
| D-16 | US Stripe account, USD currency, Test Mode first; real provider API operations and signed Dashboard deliveries through ngrok | 10-10 |
| D-17 | Never request, print, or commit credentials | 10-03, 10-06, 10-07, 10-09, 10-10, 10-12, 10-16 |
| D-18 | No demo workflow, per-seat/metered/AI-credit, multi-currency, or multiple-current-subscription capability | 10-05, 10-10, 10-12 |
| D-19 | Backend-only phase; Stripe Dashboard is not SiteFlow UI scope | 10-10, 10-12 |
| D-20 | Use real PostgreSQL and Fastify integration; deterministic policy unit tests remain offline | 10-04, 10-05, 10-07, 10-08, 10-09, 10-11, 10-14, 10-15, 10-17, 10-18, 10-19 |
| D-21 | OpenAPI plus source-evidenced Archify diagrams; no planned/unwired edges represented as live | 10-10, 10-12, 10-13, 10-15, 10-18 |
| D-22 | Preserve Phase 8 pending status and its historical billing deferral while Phase 10 supersedes scope separately | 10-01, 10-10 |

## Multi-source coverage audit

| Source | Item | Plan | Status | Notes |
|---|---|---:|---|---|
| GOAL | Phase 10 goal: secure, auditable, tenant-scoped SaaS subscription/entitlement backend in existing modular monolith; Stripe provider, PostgreSQL authority, construction-finance boundary | 10-04–10-19 | COVERED | Tracer followed by separately bounded implementation expansions, provider acceptance, and architecture evidence |
| GOAL | Versioned plans/prices, trials, and usage limits have explicit server-side rules | 10-02, 10-04, 10-05, 10-11 | COVERED | Human-approved values precede catalog and entitlement implementation |
| GOAL | Lifecycle operations and trial conversion/change/cancel/renewal/recovery are implemented and auditable | 10-02, 10-09, 10-14, 10-18, 10-19 | COVERED | Locked period-end/grace policy retained; unspecified behavior gated |
| GOAL | Stripe adapter, no redirect entitlement, signed durable tenant-safe inbox | 10-03, 10-06, 10-07, 10-12, 10-14 | COVERED | Package checkpoint, adapter boundary, raw-body ingress, durable recovery |
| GOAL | PostgreSQL-backed tenant-scoped subscription, invoice, payment, refund, history, and entitlement state; no construction-finance mixing | 10-04, 10-05, 10-08, 10-11, 10-15, 10-17 | COVERED | Refund history is separate; mutation remains guarded by authority evidence |
| GOAL | Backend operations enforce entitlements/limits under concurrent changes | 10-11, 10-19 | COVERED | PostgreSQL locking/constraints and operation-level restriction enforcement |
| GOAL | Existing auth, permissions, audit, transaction/outbox, worker, and shared validation patterns | 10-04, 10-07, 10-12–10-19 | COVERED | Reuse modules and real integration patterns |
| GOAL | Unit, integration, provider E2E, lint/typecheck/build/regression gates | 10-04–10-19 | COVERED | Real Test Mode required before provider claims |
| GOAL | Runtime validation, OpenAPI, source-evidenced Archify diagrams | 10-04, 10-12, 10-13, 10-15, 10-18, 10-10 | COVERED | Per-route schema and final verified diagram |
| GOAL | Replay, out-of-order delivery, provider outage, retry, and reconciliation recovery | 10-07, 10-14, 10-17 | COVERED | Durable inbox scan and reconciler cover replay/crash recovery |
| GOAL | Actual webhook/reminder state, actionable failures, tenant-qualified retries, and queryable worker observability | 10-07, 10-09, 10-10, 10-14 | COVERED | Persisted inbox/reminder states and phase-exit evidence distinguish acknowledgement/enqueue from reconciliation/delivery |
| REQ | BILL-01 versioned local catalog | 10-02, 10-05 | COVERED | Exact values gated by user-approved decision record |
| REQ | BILL-02 one trial and explicit paid Checkout | 10-02, 10-04, 10-12 | COVERED | Redirect is presentation only |
| REQ | BILL-03 lifecycle, history, grace, recovery | 10-02, 10-04, 10-09, 10-18, 10-19 | COVERED | Exact edge semantics and access matrix gated |
| REQ | BILL-04 enforce approved entitlements and included limits | 10-02, 10-11, 10-19 | COVERED | Units/reset/enforcement semantics gated |
| REQ | BILL-05 adapter, hosted Checkout, restricted Portal | 10-03, 10-06, 10-12, 10-13 | COVERED | SDK gate before installation |
| REQ | BILL-06 signed durable inbox and recovery | 10-03, 10-07, 10-14 | COVERED | Raw bytes, durable IDs, restart recovery |
| REQ | BILL-07 invoices, payment attempts, conditional Tax | 10-08, 10-14, 10-15, 10-16, 10-17 | COVERED | Separate SaaS records; Tax configuration explicit |
| REQ | BILL-08 guarded refund mutation and access independence | 10-17 | COVERED | Provider history persists; mutation withheld absent verified staff authority |
| REQ | BILL-09 tenant-safe routes, validation, OpenAPI, audit, finance boundary | 10-04, 10-05, 10-06, 10-11–10-13, 10-15, 10-18, 10-19 | COVERED | Shared contracts and source-resolved organization permission context |
| REQ | BILL-10 unit/integration/provider/quality gates | 10-01, 10-04–10-19 | COVERED | Pre-implementation lint baseline gate, real PostgreSQL reminder persistence/retry/idempotency/tenant tests, and real Test Mode provider acceptance |
| REQ | BILL-11 migration, diagrams, security/performance/regression phase gate | 10-01, 10-10 | COVERED | Migration reconciliation precedes schema generation |
| RESEARCH | Stripe SDK package-legitimacy SUS verdict | 10-03 | COVERED | Blocking human verification before installation |
| RESEARCH | 0040/0041 migration files absent from journal after 0039 | 10-01 | COVERED | Blocking repository/database history reconciliation |
| RESEARCH | Stripe raw-body signature, event dedupe, retries, reconciliation, tenant mapping | 10-07, 10-14 | COVERED | Durable inbox distinct from outbound outbox and restart recoverable |
| RESEARCH | Phase 9 verified notification/reminder path is intentionally unavailable and unregistered (`09-02-SUMMARY.md`) | 10-09, 10-10 | COVERED | Blocking user approval/configuration gate precedes lifecycle work; Phase 10 owns delivery persistence, transport, dispatch, retry, and observable sent/failed/pending state |
| RESEARCH | Phase 9 full-server lint baseline has four existing errors in three unchanged notification/export files (`09-03-SUMMARY.md`) | 10-01, 10-10 | COVERED | Record actual pre-implementation and final evidence; do not claim pass/cure without verification; completion stays gated on accepted disposition/resolution |
| RESEARCH | PostgreSQL/Fastify patterns, audit, worker registration, validation/OpenAPI | 10-04–10-19 | COVERED | Uses mapped analogs and live source during execution |
| RESEARCH | Stripe Tax configuration and staff-refund authorization gaps | 10-16, 10-17 | COVERED | Conditional Tax and explicit refund mutation guard |
| RESEARCH | Ten open research questions Q1–Q10 | 10-02, 10-10, 10-12, 10-16, 10-17 | COVERED | Each routed in the Decision Disposition table; no product value is inferred |
| RESEARCH | Real PostgreSQL services and user-owned Stripe Test Mode/ngrok prerequisites | 10-04, 10-10 | COVERED | No SQLite, in-memory database, or fake provider acceptance |
| CONTEXT | D-01–D-22 | As indexed above | COVERED | Deferred ideas excluded in COVERAGE.md |

## Excluded items

Only decisions explicitly listed in `10-CONTEXT.md` Deferred Ideas and Stripe capabilities explicitly excluded in `COVERAGE.md` are excluded. No roadmap goal, Phase 10 requirement, research constraint, or locked user decision is omitted.
