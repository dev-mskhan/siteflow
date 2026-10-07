# SiteFlow Requirements

**Defined:** 2026-10-07
**Core Value:** Construction teams can coordinate delivery and understand operational and financial status from tenant-isolated, auditable records they can trust.

## Validated Requirements

### Platform Foundation

- ✓ Users authenticate and work within organizations and memberships — existing.
- ✓ Organization and project access is enforced by server-side authorization and tenant context — existing; continue as a mandatory constraint.
- ✓ Important project and commercial operations preserve auditable state and use PostgreSQL as authoritative storage — existing.

### Project Operations

- ✓ Organizations can manage project core data and project members — existing.
- ✓ Project teams can manage schedules, tasks, dependencies, baselines, and schedule calculations — existing.
- ✓ Teams can manage partners, procurement, documents, compliance, and operational project workflows — existing.

### Commercial Control

- ✓ Project commercial workflows distinguish budgets, approved changes, purchase-order commitments, actual costs, billing, payments, and retainage — existing.
- ✓ Financial summaries expose documented coverage limits; subcontract commitments remain deferred until an approved source exists — existing.

## Active Requirements

### Domain Events and Communication

- [ ] EVT-01: Domain events use a versioned, immutable, uniquely identifiable envelope with organization scope, optional project scope, actor where applicable, entity identity, timestamps, and trace/correlation fields consistent with repository conventions.
- [ ] EVT-02: A business mutation and its outbox event are persisted in the same database transaction; event payloads are validated and safe to serialize, retry, and deduplicate.
- [ ] EVT-03: Event consumers are registered independently of source modules and provide handler isolation, idempotency, retry/failure state, correlation-aware logging, and observable processing without duplicate event systems.
- [ ] NTF-01: Notification intent, recipient, template/content, channel delivery, attempt, status, timestamps, failure reason, retry information, and source event/correlation are represented independently of provider-specific delivery.
- [ ] NTF-02: Email delivery uses a replaceable provider abstraction, templates, text/HTML content, retry/failure tracking, idempotency, and delivery status; sensitive credentials and financial data are not inadvertently included.
- [ ] NTF-03: One-way realtime delivery uses the repository's existing runtime if available, otherwise a minimal backend-supported transport; current organization context, project membership, and required permission are checked before subscribing and delivering scoped events. Identifiers alone never grant access.
- [ ] COM-01: WhatsApp is represented by a provider-neutral channel contract and does not require a concrete vendor unless one is configured.
- [ ] SCH-01: Scheduled operational checks use the existing background-job infrastructure and domain services to detect due-date/overdue/expiring conditions; schedulers do not send provider messages directly.
- [ ] PREF-01: User channel/event preferences are evaluated by the notification-delivery path and control channel delivery without suppressing or deleting the underlying domain event or persisted notification intent; preference hierarchy reuses existing settings conventions. A disabled channel produces no channel send/attempt while the event and intent remain persisted.

### Reporting Foundation

- [ ] RPT-01: Reporting services use authoritative server-side domain services/read models; the web client does not recalculate business metrics.
- [ ] RPT-02: Each exposed metric has a stable definition, source, filter contract, and date-range behavior so API, web UI, and downloads agree.
- [ ] RPT-03: Reporting reads are organization- and project-scoped and respect the existing authorization model; wrong-tenant resources do not leak through results or errors.

### Project and Portfolio Reports

- [ ] RPT-04: Authorized project users can view a project health report using only agreed health categories and formulas.
- [ ] RPT-05: Authorized project users can view schedule metrics derived from the existing schedule source of truth.
- [ ] RPT-06: Authorized project users can view cost/commercial metrics derived from Phase E financial truth, with coverage and unavailable values disclosed rather than fabricated.
- [ ] RPT-07: Authorized project users can view procurement metrics derived from procurement source records.
- [ ] RPT-08: Authorized project users can view subcontractor metrics derived from subcontractor and linked operational/commercial sources, without inventing contract commitments or performance scores.
- [ ] RPT-09: Authorized organization users can view an organization portfolio report with explicit project inclusion rules and tenant-safe aggregation.
- [ ] RPT-10: Users can view an executive/project summary whose component values trace to the same authoritative report services.

### Downloads and Web Delivery

- [ ] RPT-11: Authorized users can download reports as CSV; PDF and XLSX are explicitly deferred pending a later product decision.
- [ ] RPT-12: Exports use the same metric definitions, filters, date ranges, and authorization scope as the matching report API/view.
- [ ] RPT-13: Small exports may complete synchronously; exports expected or measured to exceed the repository's approximate 100 ms-under-load threshold use the existing PgBoss job infrastructure and a bounded, observable lifecycle. Artifact retention defaults to 24 hours and signed URL expiry to 5 minutes, configurable and overridden only by verified deployment policy.
- [ ] RPT-14: Any generated export is stored and downloadable only through organization/project-scoped authorization and expiring download access; report data is not exposed by guessing identifiers or object keys.
- [ ] RPT-15: Web report views expose agreed filters and CSV export and handle pending, ready, expired, and failed export states when asynchronous processing is used.

### Future Extension Boundary

- [ ] EXT-01: Reporting/module boundaries do not prevent a future platform operator perspective for usage, payments, and subscriptions; no platform billing domain is implemented by this requirement set.

## Out of Scope

- Platform-level usage metering, subscription plans, invoices, and payment processing — deferred until product and billing requirements are defined.
- Platform-operator and cross-tenant platform reporting — deferred until separate authorization and product requirements exist.
- AI-generated analysis and metric scoring without an approved product definition.
- PDF and XLSX report generation — deferred; Phase 8 delivers CSV only.
- Replacing existing queue, storage, database, or authorization infrastructure.

## Traceability

| Requirement | Planned Phase |
|-------------|---------------|
| EVT-01–EVT-03 | Phase 8 — Domain Event Foundation |
| NTF-01–NTF-03, COM-01, SCH-01, PREF-01 | Phase 8 — Notifications and Scheduled Communication |
| RPT-01–RPT-03 | Phase 8 — Phase F Reporting Foundation and Security |
| RPT-04–RPT-10 | Phase 8 — Project and Organization Portfolio Reports |
| RPT-11–RPT-15 | Phase 8 — CSV Export and Web Delivery |
| EXT-01 | Phase 8 boundary; future platform phase TBD |

---
*Last updated: 2026-10-08*
