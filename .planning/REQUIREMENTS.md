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

- [ ] RPT-11: Authorized users can download reports in PDF, XLSX, and CSV.
- [ ] RPT-12: Exports use the same metric definitions, filters, date ranges, and authorization scope as the matching report API/view.
- [ ] RPT-13: Small exports may complete synchronously; exports expected or measured to exceed the repository's approximate 100 ms-under-load threshold use the existing PgBoss job infrastructure and a bounded, observable lifecycle.
- [ ] RPT-14: Any generated export is stored and downloadable only through organization/project-scoped authorization and expiring download access; report data is not exposed by guessing identifiers or object keys.
- [ ] RPT-15: Web report views expose agreed filters and formats and handle pending, ready, expired, and failed export states when asynchronous processing is used.

### Future Extension Boundary

- [ ] EXT-01: Reporting/module boundaries do not prevent a future platform operator perspective for usage, payments, and subscriptions; no platform billing domain is implemented by this requirement set.

## Out of Scope

- Platform-level usage metering, subscription plans, invoices, and payment processing — deferred until product and billing requirements are defined.
- Notifications, WhatsApp, and realtime event delivery — not in the selected reporting-only Phase F scope.
- AI-generated analysis and metric scoring without an approved product definition.
- Replacing existing queue, storage, database, or authorization infrastructure.

## Traceability

| Requirement | Planned Phase |
|-------------|---------------|
| RPT-01–RPT-03 | Phase 8 — Phase F Reporting Foundation and Security |
| RPT-04–RPT-10 | Phase 8 — Project and Organization Portfolio Reports |
| RPT-11–RPT-15 | Phase 8 — Report Exports and Web Delivery |
| EXT-01 | Phase 8 boundary; future platform phase TBD |

---
*Last updated: 2026-10-07*
