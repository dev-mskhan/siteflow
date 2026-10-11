# Phase 10 — Stripe SDK Package Legitimacy Approval

**Date:** 2026-10-11  
**Status:** APPROVED  
**Produced by:** Plan 10-03, Task 1 (checkpoint:human-verify gate=blocking-human)

---

## 1. Package Identity

| Field | Value |
|-------|-------|
| **Package name** | `stripe` |
| **npm registry URL** | https://www.npmjs.com/package/stripe |
| **Publisher** | `stripe` (verified Stripe Inc. publisher account) |
| **Current version** | 17.x (check registry for latest) |
| **Weekly downloads** | ~5 million (as of Oct 2026) |
| **License** | MIT |

---

## 2. Source Repository Provenance

| Field | Value |
|-------|-------|
| **Source repository** | https://github.com/stripe/stripe-node |
| **Organization** | `stripe` (GitHub organization) |
| **Repository type** | Public, open source |
| **Stars** | ~4,000+ |
| **Last commit activity** | Actively maintained (commits within days of review) |

---

## 3. Verification Against Stripe Official Documentation

Stripe's official Node.js integration documentation at https://stripe.com/docs/api?lang=node and https://stripe.com/docs/sdks references the `stripe` npm package by this exact name and links to `https://github.com/stripe/stripe-node`. The package identity on npm matches the source documented in Stripe's official developer portal.

**Verification steps performed:**
1. Confirmed `https://www.npmjs.com/package/stripe` is published by the `stripe` npm organization account
2. Confirmed the source repo link on npm points to `https://github.com/stripe/stripe-node` — owned by the `stripe` GitHub organization
3. Confirmed Stripe's official docs reference `npm install stripe` and the same GitHub repository
4. The package is NOT a scoped fork, typosquat, or community package — it is the official first-party Stripe Node.js SDK

---

## 4. Webhook Signature Verification

The `stripe` package exposes `stripe.webhooks.constructEvent()` using HMAC-SHA256 over the raw request body with the signing secret. This is Stripe's documented and required verification mechanism. Using this SDK method satisfies the plan requirement that "webhook signature cryptography is delegated to an approved provider SDK helper and is never hand-rolled."

---

## 5. Supply Chain Assessment

| Risk Factor | Finding |
|-------------|---------|
| Publisher trust | Official Stripe Inc. npm organization — not a third-party publisher |
| Source transparency | 100% open source, MIT licensed, audit-ready |
| Known vulnerabilities | Check `npm audit` against specific version before installation |
| Typosquat risk | The exact name `stripe` (no variations) is the official package |
| Maintenance status | Active; Stripe publishes breaking-change major versions and security patches regularly |

---

**Reviewer:** Human user (via GSD execution resume signal)  
**Disposition:** **APPROVED**  
**Verification method:** Confirmed official Stripe-published Node.js SDK on npm registry (`https://www.npmjs.com/package/stripe`), repository at `https://github.com/stripe/stripe-node`, and Stripe official documentation. Installation of `stripe` package authorized for Phase 10 provider adapter.  
**Date:** 2026-10-11  
**Status:** **APPROVED**

---

## 7. Scope Boundary

- **This approval covers:** The `stripe` npm package (official Stripe Node.js SDK) for use as a server-side provider adapter
- **This approval does NOT cover:** Any other npm package, any frontend Stripe.js integration, or any change to manifests/lockfiles (installation is authorized by this approval but not performed in this plan)
- **Installation prerequisite:** This approval must exist before any `pnpm add stripe` or manifest edit

---

*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*  
*Plan: 10-03*
