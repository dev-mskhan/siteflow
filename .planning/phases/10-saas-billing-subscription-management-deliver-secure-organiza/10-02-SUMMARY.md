---
phase: "10"
plan: "02"
subsystem: billing/policy-gate
tags: [policy, catalog, entitlements, lifecycle, checkpoint]
requires: []
provides:
  - "10-POLICY-DECISIONS.md — approved exact billing policy inputs for catalog, limits, trial, and lifecycle"
affects:
  - "10-04, 10-05, 10-09, 10-11, 10-18, 10-19 — policy inputs unlocked"
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - ".planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-POLICY-DECISIONS.md"
  modified: []
key_decisions:
  - "Plan catalog: Starter ($199/mo), Professional ($499/mo), Enterprise ($999/mo), with 15% annual discount."
  - "Included limits: Starter (3 projects, 10 members, 50GB, 5k API calls), Pro (15 projects, 50 members, 250GB, 25k API calls), Enterprise (100 projects, 500 members, 1TB, 100k API calls)."
  - "Trial policy: 14-day no-card trial per organization with Professional tier limits and features."
  - "Grace & restriction: 7-day grace on invoice.payment_failed with Day 1/3/6 email reminders; post-grace non-destructive access restriction preserves read and billing recovery."
requirements_completed: [BILL-01, BILL-02, BILL-03, BILL-04]
duration: "~30 min"
completed: "2026-10-11"
coverage:
  - deliverable: "10-POLICY-DECISIONS.md with approved catalog, trial, limit, and lifecycle values"
    verification:
      - kind: script
        ref: "node -e policy decision record complete check"
        status: pass
    human_judgment: true
    rationale: "Human approved all policy inputs via resume signal."
---

# Phase 10 Plan 02: Policy Decision Record Summary

Established and approved explicit product policy inputs for SiteFlow SaaS billing catalog, limits, trial eligibility, lifecycle transitions, grace periods, and access restriction matrix.

**Duration:** ~30 min | **Tasks:** 1 | **Files:** 1 created

## Accomplishments

- **Approved Plan Catalog:** Starter ($199/month), Professional ($499/month), Enterprise ($999/month) with monthly and annual intervals (15% annual commitment discount). Existing subscriptions retain grandfathered price versions until explicit tier change.
- **Approved Entitlement Limits:** Defined concrete dimensions and limits per tier:
  - Active projects: 3 (Starter), 15 (Pro), 100 (Enterprise)
  - Team members: 10 (Starter), 50 (Pro), 500 (Enterprise)
  - Storage: 50 GB (Starter), 250 GB (Pro), 1,000 GB (Enterprise)
  - API calls: 5,000 (Starter), 25,000 (Pro), 100,000 (Enterprise) monthly
- **Approved Limit Enforcement Semantics:** Hard block (`403 Forbidden` with `LIMIT_EXCEEDED`) on entity creation when quota reached; no interruption to existing data; monthly quotas reset on billing anchor date; per-organization enforcement.
- **Approved Trial Rules:** Exactly one 14-day no-card trial per organization providing full Professional tier limits; expired trials require paid checkout; no re-activation.
- **Approved Lifecycle State Transitions:** Mapped Stripe events to local states (`active`, `past_due`, `canceled`, `unpaid`/`restricted`).
- **Approved Grace Period Policy:** 7-day grace period triggered on `invoice.payment_failed` with reminders at Day 1, 3, and 6; payment method update in Customer Portal resolves grace.
- **Approved Restricted-Access Matrix:** Essential account login, settings read, Stripe Portal payment update, invoice history, and existing project data read/export remain accessible; new project creation, project edits, team invites, and API access are blocked.

## Verification Results

- ✅ PASS `node -e` check: `10-POLICY-DECISIONS.md` contains APPROVED status and all required categories (plan names, price, billing interval, limit units, trial start trigger, trial eligibility, grace start, restricted-access matrix).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
