# Phase 10: SaaS Billing & Subscription Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `10-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-10-10
**Phase:** 10-saas-billing-subscription-management-deliver-secure-organiza
**Areas discussed:** Plan catalog and trial policy, Subscription lifecycle and access, Invoices/payments/refunds, Stripe dashboard setup

---

## Plan Catalog and Trial Policy

| Option | Description | Selected |
|--------|-------------|----------|
| 14 days | Recommended default for eligible organization's no-card trial | ✓ |
| 7 days | Shorter trial | |
| 30 days | Longer trial | |
| No trial | Require paid checkout from start | |
| Card up front | Automatically convert unless canceled | |
| No card | Require explicit paid checkout after trial | ✓ |
| Sales-approved trial | Provision only for approved organizations | |
| One per organization | Enforce one trial per organization | ✓ |
| One per user | Limit at user identity instead | |
| Fixed organization price | Recurring org-level price with included limits | ✓ |
| Per-seat | Base subscription plus seat pricing | |
| Metered | Base subscription plus measured usage | |

**User's choice:** One 14-day no-card trial per organization; fixed recurring organization pricing with included limits.
**Notes:** Exact tiers, amounts, and included limits remain open for research/planning. The user asked to add a book-a-demo capability; this was clarified as separate from trial provisioning and deferred from subscription billing scope.

---

## Subscription Lifecycle and Access

| Option | Description | Selected |
|--------|-------------|----------|
| Downgrade at period end | Preserve current paid plan until renewal | ✓ |
| Immediate downgrade | Apply immediately with explicit proration | |
| Cancel at period end | Preserve access through paid period | ✓ |
| Cancel immediately | End access on immediate cancellation | |
| Seven-day grace | Reminders then restrict access after confirmed failed renewal | ✓ |
| Fourteen-day grace | Longer recovery period | |
| Immediate restriction | Restrict after confirmed failure | |
| Manual review | No automatic restriction policy | |
| One active subscription | Retain history, permit one current active subscription per org | ✓ |
| Multiple concurrent | Permit multiple active subscriptions per org | |

**User's choice:** Period-end downgrade and cancellation; seven-day grace with reminders; one active subscription per organization, with history retained.
**Notes:** Exact limited-access behavior, trial expiry, retries, payment action, reactivation, and proration semantics remain subject to source/research and explicit policy where they change the customer's access.

---

## Invoices, Payments, and Refunds

| Option | Description | Selected |
|--------|-------------|----------|
| Stripe invoice | Stripe generates SaaS invoices; SiteFlow syncs locally | ✓ |
| SiteFlow invoice | SiteFlow generates; Stripe collects | |
| Platform-only refunds | Restrict initiation to privileged SiteFlow billing staff | ✓ |
| Org refund request | Billing admin requests, staff approves | |
| Org direct refund | Organization billing admin initiates refund | |
| Refund separate | Refund does not itself cancel/restrict subscription | ✓ |
| Refund cancels | Refund triggers cancellation | |
| Refund restricts | Any refund restricts entitlements | |
| Stripe Tax | Use if enabled; synchronize tax values locally | ✓ |
| External tax setup | Configure outside initial billing implementation | |

**User's choice:** Stripe-generated invoices synchronized locally; refunds are privileged platform-staff actions; refund state is separate from subscription access; use Stripe Tax if enabled.
**Notes:** Verify a platform staff authorization mechanism before planning refund routes. Keep all these records separate from construction invoices/payments.

---

## Stripe Dashboard Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Test Mode first | Build and verify against test objects before live mode | ✓ |
| Live immediately | Configure production credentials from start | |
| Hosted Checkout | Server creates Stripe-hosted Checkout sessions | ✓ |
| Embedded checkout | Use embedded Elements UI | |
| SiteFlow catalog | Local catalog owns policy; Stripe Price IDs are mapped references | ✓ |
| Stripe catalog | Treat Stripe Products/Prices as primary plan rules | |
| US / USD | Initial test account region and billing currency | ✓ |
| Dashboard-registered ngrok endpoint | Register HTTPS callback in Stripe Dashboard Test Mode | ✓ |
| Stripe CLI / both | Alternative local forwarding/replay choices | |
| Customer Portal | Use Stripe portal for payment-method management and invoice viewing | ✓ |
| Real provider E2E | Test Mode API operations and signed dashboard deliveries via ngrok; pure unit tests stay offline | ✓ |

**User's choice:** US account, USD, Test Mode first, hosted Checkout, SiteFlow-owned catalog mapped to Stripe Price IDs, dashboard-registered ngrok webhook endpoint, Stripe Customer Portal, and real Stripe Test Mode for integration/E2E acceptance.
**Notes:** User needs to create/activate their Stripe account and later configure test Products/Prices, Customer Portal, and a webhook destination once the implementation's endpoint and event allowlist are known. Secret keys must be stored locally/in deployment configuration, never in chat or commits.

---

## the agent's Discretion

- Research exact provider semantics, SDK/API version, schema boundaries, webhook events, routes, and safe retry/reconciliation model against current source.
- Keep product-policy changes and unknown access rules visible for user decision; do not infer them from provider defaults.
- Use pure offline unit tests for local deterministic rules and real Stripe Test Mode in provider integration/E2E acceptance.

## Deferred Ideas

- Book-a-demo sales/onboarding lead capture and scheduling is distinct from trial provisioning; consider separately.
- Per-seat/metered/AI-credit pricing and multiple active subscriptions were not selected for initial release.
