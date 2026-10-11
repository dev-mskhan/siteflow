# Billing API Integration (Phase 10)

Frontend guide for the SaaS billing endpoints. Source: `apps/server/src/modules/billing/`.

Status legend: **Verified** = read from route source in this review. **Unverified** = not confirmed by a test or runtime check.

## 1. Endpoint Summary

| Method | Route | Purpose | Route file |
|---|---|---|---|
| POST | `/:organizationId/billing/checkout` | Start a Stripe Checkout session | `checkout.routes.ts` |
| POST | `/:organizationId/billing/portal` | Open the Stripe billing portal | `portal.routes.ts` |
| POST | `/:organizationId/billing/trial` | Start or fetch the trial | `trial.routes.ts` |
| GET | `/:organizationId/billing/trial` | Read trial status | `trial.routes.ts` |
| GET | `/:organizationId/billing/invoices` | Invoice history | `invoice.routes.ts` |
| POST | `/:organizationId/billing/subscription/cancel` | Cancel at period end | `lifecycle.routes.ts` |
| POST | `/:organizationId/billing/subscription/downgrade` | Schedule a downgrade at period end | `lifecycle.routes.ts` |
| POST | `/:organizationId/billing/subscription/upgrade` | Apply an upgrade immediately | `lifecycle.routes.ts` |
| POST | `/:organizationId/billing/subscription/pause` | Not supported by policy (D-07) | `lifecycle.routes.ts` |
| POST | `/:organizationId/billing/subscription/reactivate` | Undo a scheduled cancellation | `lifecycle.routes.ts` |
| POST | `/api/v1/webhooks/payment` (and `/stripe`) | Stripe webhook receiver. Not called by the frontend. | `webhook.routes.ts` |

All organization-scoped routes take `organizationId` as a path parameter. The frontend must not treat it as a trusted ownership claim. The backend enforces membership and billing permissions.

## 2. Shared Conventions

- **Auth:** Authenticated session required. Billing permissions are checked on the backend.
- **Errors:** Standard application error envelope (see `apps/server/src/shared/response.ts`). Error codes are listed per endpoint only where verified.
- **Idempotency:** Checkout requires an `Idempotency-Key` header (see §3.1).
- **Restricted state:** Organizations in RESTRICTED state are blocked from project create, project update, and member invite (`10-POLICY-DECISIONS.md`). Other restricted-state actions are not confirmed here.

## 3. Endpoints

### 3.1 Start Checkout — `POST /:organizationId/billing/checkout`

- **Headers:** `Idempotency-Key` (required, validated against a regex in the route).
- **Body:** Strict schema (`.strict()`). Shared `PlanId` and `BillingInterval` enums. Unknown fields are rejected.
- **Response:** Stripe Checkout session URL. Success and cancel URLs are built from the frontend base URL with paths `/billing/checkout/success` and `/billing/checkout/cancel`.
- **Frontend:** Redirect the browser to the returned URL. On return, refresh subscription and trial state rather than trusting the query string.
- **Verified:** Schema, header, and redirect paths (`checkout.routes.ts` ~17–24, ~131–134).
- **Unverified:** Exact response envelope and error codes.

### 3.2 Billing Portal — `POST /:organizationId/billing/portal`

- **Body:** None. Path params are validated with inline Zod.
- **Response:** Portal session URL. Return target is `/billing` on the frontend base URL.
- **Verified:** Route and return target (`portal.routes.ts` lines 18, 28).
- **Unverified:** Error codes and response envelope.

### 3.3 Trial — `POST` and `GET /:organizationId/billing/trial`

- **POST:** Starts a trial or returns the existing one. No body. Path params validated by Fastify schema.
- **GET:** Returns current trial status.
- **Verified:** Routes (`trial.routes.ts` lines 13–15, 50–52).
- **Unverified:** Response shape and error codes. The route file has a known type error (see §6).

### 3.4 Invoices — `GET /:organizationId/billing/invoices`

- **Query:** Validated with shared `saasInvoiceHistoryQuerySchema` from `@siteflow/shared`.
- **Response:** Validated with shared `saasInvoiceHistoryDataSchema`.
- **Verified:** Route and shared schemas (`invoice.routes.ts` line 66).
- **Unverified:** Pagination field names and error codes. Confirm against the shared schema before coding against them.

### 3.5 Subscription Lifecycle

All five are `POST /:organizationId/billing/subscription/{action}`.

| Action | Behavior | Status |
|---|---|---|
| `cancel` | Cancels at period end | Verified route |
| `downgrade` | Schedules plan downgrade at period end | Verified route |
| `upgrade` | Applies upgrade immediately | Verified route |
| `pause` | Not supported (D-07). Returns a not-supported response. | Verified route, response unverified |
| `reactivate` | Undoes a scheduled cancellation | Verified route |

- **Body:** `upgrade` and `downgrade` take a target plan and interval. The route does **not** validate the body at runtime. It relies on TypeScript types and Fastify enum checks only.
- **Frontend:** After any lifecycle action, refetch subscription and trial state. Do not compute the resulting plan on the client.
- **Unverified:** Exact request body schema and response envelope for each action.

### 3.6 Webhook — `POST /api/v1/webhooks/payment` (and `/stripe`)

- Called by Stripe, not by the frontend.
- Requires a raw body and a valid Stripe signature. Events are allowlisted.
- Both paths share one handler (`webhook.routes.ts` lines 29, 126–127).

## 4. Business Rules

- Subscription changes are applied by Stripe and reconciled through webhooks. The frontend should treat server responses as the source of truth and refetch after mutations.
- Upgrades apply immediately. Downgrades and cancellations take effect at period end.
- The server owns entitlement decisions (`entitlement.service.ts`, `entitlement.policy.ts`). The frontend may hide actions for better UX, but the backend enforces them.

## 5. Frontend Handling

- **Loading:** Disable the triggering control while a mutation is in flight.
- **Checkout:** Generate a new `Idempotency-Key` per user intent and reuse it only for retries of the same intent.
- **Forbidden / restricted:** Show a message that the action is unavailable for the current plan or state. Do not retry automatically.
- **Validation errors:** Show field errors from the response body where present.
- **Server errors:** Show a generic message and offer retry. Do not display raw error details.
- **After mutations:** Refetch subscription, trial, and invoice data.

## 6. Known Gaps

1. **Shared-schema consistency.** Only invoices uses shared schemas from `@siteflow/shared` (`saasInvoiceHistoryQuerySchema`, `saasInvoiceHistoryDataSchema`). This matches the project-module convention (`packages/shared/src/modules/project/*.schema.ts`). Checkout and portal define Zod inline. Trial and lifecycle have no runtime schemas. `packages/shared/src/modules/billing/lifecycle.schema.ts` exports only `cancelSubscriptionResponseSchema`, and the routes do not use it. Recommend moving trial, lifecycle, checkout, and portal schemas into `packages/shared/src/modules/billing/` in a follow-up.
2. **Type errors.** `trial.routes.ts` (lines ~32, ~69) and `invoice.routes.ts` (line ~138) have typecheck errors. Whether these predate Phase 10 is not yet confirmed.
3. **`api:access`.** Not implemented. No API-key surface exists. Blocked in RESTRICTED state per `10-POLICY-DECISIONS.md` line 99. Requires a product decision.
4. **Pre-existing test failures.** 24 `project_core` tests fail on clean code, unrelated to billing.
5. **Unverified responses.** Response envelopes and error codes for most endpoints are not yet confirmed against tests. Verify before relying on them.

## 7. Files

- Routes: `apps/server/src/modules/billing/{checkout,portal,trial,invoice,lifecycle,webhook}.routes.ts`
- Shared: `packages/shared/src/modules/billing/`, `packages/shared/src/index.ts`
- Policy: `.planning/phases/10-*/10-POLICY-DECISIONS.md`
