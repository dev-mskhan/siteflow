# Phase 10 — Billing Policy Decisions

**Date:** 2026-10-11  
**Status:** Pending human approval  
**Produced by:** Plan 10-02, Task 1 (checkpoint:decision gate=blocking-human)

---

> **This document requires explicit human approval for every value below before any billing implementation begins.**
> Any field left as "UNRESOLVED" blocks the corresponding implementation tasks.
> The locked choices from `10-CONTEXT.md` (no-card 14-day trial, explicit paid Checkout, one-current-subscription, period-end downgrade/cancel, 7-day confirmed-failure grace) are preserved as-is and not re-opened here.

---

## D-03 / D-04: Plan Catalog — Exact Values

### Plans

| Field | Value | Status |
|-------|-------|--------|
| Plan name(s) | *(e.g. "Starter", "Professional", "Enterprise")* | **UNRESOLVED — fill in** |
| USD price per plan per billing interval | *(e.g. Starter: $49/month)* | **UNRESOLVED — fill in** |
| Billing interval(s) | Monthly only / Annual only / Both | **UNRESOLVED — fill in** |
| Annual discount (if any) | *(e.g. 2 months free = 16.7% off)* | **UNRESOLVED — fill in** |
| Price-change / grandfathering policy | *(e.g. existing subscribers locked at current price until they change plan)* | **UNRESOLVED — fill in** |

### Included Limits per Plan

| Limit dimension | Starter | Professional | Enterprise | Unit / reset | Status |
|-----------------|---------|--------------|------------|--------------|--------|
| Active projects | ? | ? | ? | count, no reset | **UNRESOLVED** |
| Team members (org users) | ? | ? | ? | count, no reset | **UNRESOLVED** |
| Storage | ? | ? | ? | GB, no reset | **UNRESOLVED** |
| API calls / month | ? | ? | ? | count, monthly reset | **UNRESOLVED** |
| *(other limits)* | ? | ? | ? | | **UNRESOLVED** |

### Limit Enforcement and Reset Semantics

| Question | Answer | Status |
|----------|--------|--------|
| What happens when a limit is hit? (hard block vs. grace / overage) | **UNRESOLVED** | |
| When do monthly-reset limits reset? (billing anchor date vs. calendar month start) | **UNRESOLVED** | |
| Are limits enforced per-organization or per-user? | Per-organization | Locked (D-03) |
| Can unused quota roll over? | **UNRESOLVED** | |

---

## D-01: Trial — Start Trigger and Eligibility Identity

| Question | Answer | Status |
|----------|--------|--------|
| What event triggers trial start? | *(e.g. first successful organization creation, first admin login, explicit opt-in action)* | **UNRESOLVED** |
| What identity key establishes "one trial per organization"? | Organization ID (SiteFlow-owned record) | Locked |
| Can a trial be re-activated after expiry? | **UNRESOLVED** | |
| Is there a trial for each plan tier, or only for one tier? | **UNRESOLVED** | |

---

## D-07: Lifecycle — Period-End Transition Mapping

| Stripe event | Local lifecycle state transition | Status |
|-------------|----------------------------------|--------|
| `invoice.payment_succeeded` → renewal | active → active (reset period) | **UNRESOLVED — confirm mapping** |
| `invoice.payment_failed` (first failure) | active → ? | **UNRESOLVED** |
| `customer.subscription.deleted` at period end | active → canceled (access until period end) | Locked principle; confirm exact state name |
| Downgrade scheduled at period end | active → downgrade_scheduled | **UNRESOLVED — confirm state name** |
| Payment requires action (`requires_payment_method`) | active → ? | **UNRESOLVED** |
| `customer.subscription.paused` | Should SiteFlow support Stripe-native pause? | **UNRESOLVED** |
| `customer.subscription.resumed` | ? | **UNRESOLVED if pause supported** |
| Upgrade / proration | **UNRESOLVED — immediate or end-of-period?** | |

---

## D-08: Grace Period — Start and Reminder/Retry Handling

| Question | Answer | Status |
|----------|--------|--------|
| What confirms a "failed renewal" to trigger the 7-day grace? | *(e.g. Stripe's `invoice.payment_action_required` after retries exhausted, or after N consecutive failures)* | **UNRESOLVED** |
| How many Stripe retry attempts before grace begins? | **UNRESOLVED** | |
| Reminder schedule during 7-day grace | *(e.g. Day 1, Day 3, Day 7)* | **UNRESOLVED** |
| Reminder channel / delivery transport | *(e.g. email via existing notification system, in-app)* | **UNRESOLVED** |
| After 7 days without payment | Access restricted per D-09 matrix | Locked principle |
| Can users resolve grace period by updating payment in Portal? | Yes (Portal payment-method management enabled) | Locked |

---

## D-09: Restricted-Access Matrix

> Locked principles: essential account and billing recovery paths must be preserved; customer data must not be deleted on restriction.

| Operation | Trial-active | Active (paid) | Grace period | Restricted (post-grace) | Status |
|-----------|:---:|:---:|:---:|:---:|--------|
| Login / authenticate | ✅ | ✅ | ✅ | ✅ | Locked (essential) |
| View organization settings | ✅ | ✅ | ✅ | ✅ | **UNRESOLVED — confirm** |
| Update payment method via Portal | ✅ | ✅ | ✅ | ✅ | Locked (billing recovery) |
| View billing history / invoices | ✅ | ✅ | ✅ | ✅ | Locked (billing recovery) |
| Create new project | ✅ | ✅ | ✅ | ❌ | **UNRESOLVED — confirm** |
| Modify existing projects | ✅ | ✅ | ✅ | ❌ | **UNRESOLVED** |
| View / read existing project data | ✅ | ✅ | ✅ | ✅ | **UNRESOLVED — confirm (data preservation)** |
| Export/download data | ✅ | ✅ | ✅ | ✅ | **UNRESOLVED — confirm (data access right)** |
| Invite new team members | ✅ | ✅ | ✅ | ❌ | **UNRESOLVED** |
| API access (external) | ✅ | ✅ | ✅ | ❌ | **UNRESOLVED** |
| *(other operations)* | | | | | **Fill in as needed** |

---

## D-02: Payment-Required / Trial-Expiry / Reactivation

| Scenario | Expected behavior | Status |
|----------|------------------|--------|
| Trial expires without Checkout | Access restricted per D-09 matrix immediately | Locked principle |
| User completes Checkout during trial | Subscription becomes active (Stripe-managed); SiteFlow synchronizes | Locked |
| User completes Checkout in grace period | Subscription renewed; grace lifted; access restored | **UNRESOLVED — confirm handling** |
| User completes Checkout in restricted state | Subscription starts; access restored | **UNRESOLVED — confirm** |
| `requires_payment_method` during cycle | **UNRESOLVED — SiteFlow state during Stripe retry window?** | |
| Proration on plan upgrade | **UNRESOLVED — immediate prorate or end-of-period?** | |

---

## Approval Record

> **To approve this document:**
> Fill in every UNRESOLVED field above with the exact product-approved values.
> Then sign below. Any field remaining UNRESOLVED at sign-off keeps the corresponding implementation blocked.
> The locked choices (no-card trial, explicit Checkout, one subscription, period-end downgrade, 7-day grace) must remain unchanged.

**Approver:**  
**Disposition:**  
**plan names:** *(fill in)*  
**price:** *(fill in)*  
**billing interval:** *(fill in)*  
**limit units:** *(fill in)*  
**trial start trigger:** *(fill in)*  
**trial eligibility:** per-organization (organization ID key) — LOCKED  
**grace start:** *(fill in confirmed event)*  
**restricted-access matrix:** *(confirm or modify the table above)*  
**Date:**

---

*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*  
*Plan: 10-02*
