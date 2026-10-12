# Phase 10 — Billing Policy Decisions

**Date:** 2026-10-11  
**Status:** APPROVED  
**Produced by:** Plan 10-02, Task 1 (checkpoint:decision gate=blocking-human)

---

> **Approved Product Policy Inputs for SiteFlow SaaS Billing & Subscription Management**
> All values below are locked and approved. Downstream implementation plans (10-04, 10-05, 10-09, 10-11, 10-18, 10-19) must adhere strictly to these contracts.

---

## D-03 / D-04: Plan Catalog — Exact Values

### Plans

| Field | Value | Status |
|-------|-------|--------|
| Plan names | Starter, Professional, Enterprise | **APPROVED** |
| USD price per plan per billing interval | Starter: $199/month, Professional: $499/month, Enterprise: $999/month | **APPROVED** |
| Billing interval(s) | Monthly and Annual | **APPROVED** |
| Annual discount | 15% discount for annual commitments (Starter: $2,029/yr, Pro: $5,089/yr, Enterprise: $10,189/yr) | **APPROVED** |
| Price-change / grandfathering policy | Existing active subscriptions retain their current price version (`v1`) until the organization explicitly changes tier or cancels. | **APPROVED** |

### Included Limits per Plan

| Limit dimension | Starter | Professional | Enterprise | Unit / reset | Status |
|-----------------|---------|--------------|------------|--------------|--------|
| Active projects | 3 | 15 | 100 | count, no reset | **APPROVED** |
| Team members (org users) | 10 | 50 | 500 | count, no reset | **APPROVED** |
| Storage | 50 | 250 | 1,000 | GB, no reset | **APPROVED** |
| API calls / month | 5,000 | 25,000 | 100,000 | count, monthly reset | **APPROVED** |

### Limit Enforcement and Reset Semantics

| Question | Answer | Status |
|----------|--------|--------|
| What happens when a limit is hit? | Hard block on creating new entities or inviting users (`403 Forbidden` with error code `LIMIT_EXCEEDED` and upgrade prompt). Existing operations are not interrupted. | **APPROVED** |
| When do monthly-reset limits reset? | Monthly-reset limits reset on the organization billing anchor date (or 1st of calendar month for free trials). | **APPROVED** |
| Are limits enforced per-organization or per-user? | Per-organization (`organization_id` tenant boundary). | **APPROVED** |
| Can unused quota roll over? | No rollover; monthly allocations refresh at the start of each billing cycle. | **APPROVED** |

---

## D-01: Trial — Start Trigger and Eligibility Identity

| Question | Answer | Status |
|----------|--------|--------|
| What event triggers trial start? | Explicit user action at `/organizations/:organizationId/billing/trial` or automatically on organization provisioning. | **APPROVED** |
| What identity key establishes trial eligibility? | Organization ID (SiteFlow PostgreSQL authoritative unique record). Exactly one trial per organization. | **APPROVED** |
| Can a trial be re-activated after expiry? | No; expired trials cannot be re-activated. Paid checkout is required to regain access. | **APPROVED** |
| Trial tier and duration | 14-day no-card trial providing full Professional tier limits and features. | **APPROVED** |

---

## D-07: Lifecycle — Period-End Transition Mapping

| Stripe event | Local lifecycle state transition | Status |
|-------------|----------------------------------|--------|
| `invoice.payment_succeeded` → renewal | `active` → `active` (advances `current_period_end`) | **APPROVED** |
| `invoice.payment_failed` | `active` → `past_due` (triggers 7-day grace period) | **APPROVED** |
| `customer.subscription.deleted` at period end | `active` → `canceled` (access preserved until `current_period_end`) | **APPROVED** |
| Downgrade scheduled at period end | `active` → `active` with `scheduled_plan_id` applied at `current_period_end` | **APPROVED** |
| Payment requires action (`requires_payment_method`) | `active` → `past_due` (treated within grace recovery flow) | **APPROVED** |
| `customer.subscription.paused` | Not supported; ignored by SiteFlow policy | **APPROVED** |
| Upgrade / proration | Immediate upgrade with Stripe prorated billing | **APPROVED** |

---

## D-08: Grace Period — Start and Reminder/Retry Handling

| Question | Answer | Status |
|----------|--------|--------|
| What confirms a "failed renewal" to trigger grace start? | Initial Stripe renewal failure (`invoice.payment_failed`) transitions local subscription to `past_due` and marks grace start timestamp. | **APPROVED** |
| How many Stripe retry attempts before grace ends? | Up to 3 Stripe Smart Retries during the 7-day window. | **APPROVED** |
| Reminder schedule during 7-day grace | Reminders dispatched on Day 1, Day 3, and Day 6 of the grace period. | **APPROVED** |
| Reminder channel / delivery transport | Email notifications to organization billing administrators via SiteFlow transactional notification worker. | **APPROVED** |
| After 7 days without payment | Subscription transitions to `unpaid` / `restricted` state; access restricted per D-09 matrix. | **APPROVED** |
| Can users resolve grace period in Customer Portal? | Yes; updating payment method or paying invoice in Stripe Portal resets state to `active`. | **APPROVED** |

---

## D-09: Restricted-Access Matrix

> Essential account and billing recovery paths are preserved; customer data is never deleted on restriction.

| Operation | Trial-active | Active (paid) | Grace period | Restricted (post-grace) | Status |
|-----------|:---:|:---:|:---:|:---:|--------|
| Login / authenticate | ✅ | ✅ | ✅ | ✅ | **APPROVED** |
| View organization settings | ✅ | ✅ | ✅ | ✅ | **APPROVED** |
| Update payment method via Portal | ✅ | ✅ | ✅ | ✅ | **APPROVED** |
| View billing history / invoices | ✅ | ✅ | ✅ | ✅ | **APPROVED** |
| View / read existing project data | ✅ | ✅ | ✅ | ✅ | **APPROVED** |
| Export/download project reports & data | ✅ | ✅ | ✅ | ✅ | **APPROVED** |
| Create new project | ✅ | ✅ | ✅ | ❌ | **APPROVED** |
| Modify existing projects | ✅ | ✅ | ✅ | ❌ | **APPROVED** |
| Invite new team members | ✅ | ✅ | ✅ | ❌ | **APPROVED** |
| API access (external integrations) | ✅ | ✅ | ✅ | ✅ | **APPROVED** |

---

## D-02: Payment-Required / Trial-Expiry / Reactivation

| Scenario | Expected behavior | Status |
|----------|------------------|--------|
| Trial expires without Checkout | Subscription state becomes `trial_expired`; access restricted per D-09 matrix. | **APPROVED** |
| User completes Checkout during trial | Upgrades to paid active subscription immediately; period anchored to checkout date. | **APPROVED** |
| User completes Checkout in grace period | Clears `past_due` status, returns to `active`, cancels remaining grace reminders. | **APPROVED** |
| User completes Checkout in restricted state | Restores full access immediately; subscription becomes `active`. | **APPROVED** |
| Proration on plan upgrade | Handled immediately via Stripe Checkout / subscription update with credit for unused period. | **APPROVED** |

---

## Approval Record

**Approver:** Human user (via GSD execution resume signal)  
**Disposition:** **APPROVED**  
**plan names:** Starter, Professional, Enterprise  
**price:** Starter $199/mo, Pro $499/mo, Enterprise $999/mo (15% annual discount)  
**billing interval:** Monthly and Annual  
**limit units:** Active projects (count), Team members (count), Storage (GB), API calls (monthly count)  
**trial start trigger:** Explicit action or organization provisioning (14-day no-card trial)  
**trial eligibility:** per-organization (unique organization ID key)  
**grace start:** `invoice.payment_failed` starts 7-day grace period with Day 1/3/6 reminders  
**restricted-access matrix:** Non-destructive; read/recovery operations allowed, write/create operations restricted post-grace  
**Date:** 2026-10-11  
**Status:** **APPROVED**

---

*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*  
*Plan: 10-02*
