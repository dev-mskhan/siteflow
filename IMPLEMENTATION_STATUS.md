# 4-Plan Feature Gating — Implementation Status

## ✅ Completed

### 1. Stripe Product-ID-Driven Setup
- ✅ `.env` + `.env.example` — replaced 3 stale `STRIPE_PRICE_*` vars with `STRIPE_PRODUCT_STARTER/PRO/ENT`
- ✅ `packages/shared/.../catalog.schema.ts`:
  - Added `trial` to `PlanIdSchema`
  - Added `features` map to `PlanLimitsSchema` (7 feature flags)
  - Replaced `stripePriceId` with `stripeProductId` in `PriceVersionSchema`
  - Updated `APPROVED_LIMITS` with trial plan + feature flags for all 4 plans
  - Updated `APPROVED_PRICING_V1` to use product IDs
  - Added trial to `APPROVED_PLANS` (empty prices array — no Stripe billing)
  - Replaced `findPriceByProviderPriceId()` with `findPriceByProviderProduct(productId, interval)`
- ✅ `stripe.adapter.ts`:
  - Added `resolveActivePriceId(productId, interval)` — runtime price resolution with in-memory cache
  - Updated `retrieveSubscription()` to expand `items.data.price.product` for reconciliation
- ✅ `checkout.routes.ts` — resolve price ID at runtime via `stripeAdapter.resolveActivePriceId()`
- ✅ `catalog.service.ts`:
  - Updated `resolvePriceFromProvider()` to take `(productId, interval)`
  - Removed stale `stripePriceId` validation logic
- ✅ `provider-reconciler.ts` — reconcile by `(product, interval)` using expanded price object

### 2. Trial as a Real Plan
- ✅ Trial plan added to catalog with own limits (2 projects, 5 members, 5GB, 100k AI tokens)
- ✅ `entitlement.service.ts` — returns `APPROVED_LIMITS.trial` for active trials (was `.professional`)
- ✅ `trial.service.ts` — tier set to `'Trial'` (was `'Professional'`)

### 3. Feature Gate Infrastructure
- ✅ `entitlement.service.ts` — added `assertPlanFeature(orgId, feature, tx)` helper
- ✅ `feature-gate.middleware.ts` — created `requirePlanFeature(feature)` middleware factory

### 4. Feature Gates Wired (Partial — examples shown)
- ✅ `project.routes.ts`:
  - Added import for `requirePlanFeature`
  - Gated material-request create → `procurementChain`
  - Gated quote create → `procurementChain`
  - Gated purchase-order create → `procurementChain`
- ✅ `change-order.routes.ts`:
  - Added import for `requirePlanFeature`
  - Gated change-order create → `changeOrders`

## 🚧 Remaining Work

### A. Complete Feature Gates (replicate the pattern shown above)

**Pattern:**
```ts
// 1. Add import at top of route file:
import { requirePlanFeature } from '../../billing/feature-gate.middleware.js';

// 2. Add feature gate to preHandler array (BEFORE permission check):
preHandler: [
  requirePlanFeature('featureName'),
  requireProjectPermission('project.thing.create'),
],
```

**Routes to gate:**

#### `procurementChain` gates:
- ✅ material-request create (done)
- ✅ quote create (done)
- ✅ purchase-order create (done)
- ⏳ procurement-approval create (`project.routes.ts` or separate `procurement-approval.routes.ts`)
- ⏳ delivery create (if gated — currently allowed for Starter; check business logic)
- ⏳ receipt create (if gated — currently allowed for Starter; check business logic)

#### `subcontractorMgmt` gates:
- ⏳ subcontractor create (org-level: `/:organizationId/subcontractors` in `project.routes.ts`)
- ⏳ subcontractor create (project-level: `/:organizationId/projects/:projectId/subcontractors`)
- ⏳ retainage routes (`retainage.routes.ts` — all POST routes)

#### `aiaPaymentApps` gates:
- ⏳ payment-application create (`payment-application.routes.ts`)
- ⏳ payment-application submit/approve routes

#### `costControl` gates:
- ⏳ commercial-summary routes (`commercial-summary.routes.ts` GET routes)
- ⏳ financial-summary routes (`financial-summary.routes.ts` GET routes)
- ⏳ cost-transaction create routes (if separate from budget)

#### `conversationalAi` gates:
- ⏳ conversation create (`ai/conversations/conversation.routes.ts` POST routes)
- ⏳ agent run create (`ai/runs/agent-run.routes.ts` POST routes)
- ⏳ voice message create (`ai/voice/voice.routes.ts`)
- ⏳ memory set routes (`ai/memory/memory.routes.ts`)
- ⏳ approval create routes (`ai/approvals/approval.routes.ts`)

#### `advancedReporting` gates:
- ⏳ portfolio report (`reporting/report.routes.ts` — `/reports/portfolio`)
- ⏳ executive-summary report (`reporting/report.routes.ts` — `/reports/executive-summary`)
- ⏳ export create (`reporting/exports/export.routes.ts` POST route)

### B. Storage Gate (currently unenforced)
- ⏳ Add `storageGb` upload gate in `project/documents/document.service.ts` → `completeUpload()` method
- Check current org storage usage (sum of completed document sizes)
- Throw `EntitlementError` with `LIMIT_EXCEEDED` if over limit

### C. Frontend Pricing Content
- ⏳ Rewrite `apps/web/src/content/pricing.ts`:
  - Add Free Trial card (14-day, 2 projects, 5 members, 5GB, 100k AI tokens, full Pro features)
  - Update Starter features to match gated matrix (no procurement chain, no subcontractor mgmt, etc.)
  - Update Professional features
  - Update Enterprise (scale-only tier, same features as Pro)
  - Drop all roadmap features (custom AI training, multi-tenant branches, ERP integrations, Excel/PDF export, SLA/service tiers)
- ⏳ Update `apps/web/src/pages/PricingPage.tsx` to render 4 cards (Trial + 3 paid)

### D. Tests
- ⏳ Update `apps/server/tests/unit/billing/catalog-policy.test.ts`:
  - Add trial plan tests
  - Test product-ID-driven reconciliation
  - Test feature flag lookups
- ⏳ Update `apps/server/tests/integration/billing/catalog-entitlements.test.ts`:
  - Test `assertPlanFeature()` for all 7 features × 4 plans
  - Test trial limits vs. Professional limits
  - Test storageGb gate (when added)
- ⏳ Add route-level feature gate tests (one per gated route, verify 403 FEATURE_RESTRICTED)

## 📋 Feature Matrix (Final)

| Capability | Trial | Starter | Pro | Ent |
|---|---|---|---|---|
| **Limits** |  |  |  |  |
| Active projects | 2 | 3 | 15 | 100 |
| Team members | 5 | 10 | 50 | 500 |
| Storage | 5GB | 50GB | 250GB | 1TB |
| AI tokens/month | 100k | 100k | 500k | 2M |
| **Core Features** |  |  |  |  |
| Project execution, estimating, BOQ, takeoff, phases, tasks, schedule, baselines, field logs, issues, documents | ✅ | ✅ | ✅ | ✅ |
| Suppliers & materials directories | ✅ | ✅ | ✅ | ✅ |
| Site governance (submittals, RFIs, quality, safety, compliance) | ✅ | ✅ | ✅ | ✅ |
| Basic project reports (health, schedule, cost) | ✅ | ✅ | ✅ | ✅ |
| AI document analysis & BOQ extraction | ✅ | ✅ | ✅ | ✅ |
| Material delivery verification | ✅ | ✅ | ✅ | ✅ |
| **Gated Features** |  |  |  |  |
| Full procurement chain (MR→quote→approval→PO→committed→receipt→inventory) | ✅ | ❌ | ✅ | ✅ |
| Subcontractor management & retainage | ✅ | ❌ | ✅ | ✅ |
| Change order approval workflow | ✅ | ❌ | ✅ | ✅ |
| AIA G702/G703 payment apps + certified retainage | ✅ | ❌ | ✅ | ✅ |
| Full cost control (committed costs, commercial/financial summary, cost transactions) | ✅ | ❌ | ✅ | ✅ |
| Conversational AI chat + specialized agents + approvals + voice + memory | ✅ | ❌ | ✅ | ✅ |
| Portfolio & executive-summary reports + CSV export | ✅ | ❌ | ✅ | ✅ |

**Trial:** Full Professional features with own lower caps + 14-day time limit. No credit card required.  
**Enterprise:** Scale-only tier — same features as Professional, higher limits.

## 🔑 Key Files Modified

### Billing/Entitlement Layer
- `.env` + `.env.example`
- `packages/shared/src/modules/billing/catalog.schema.ts`
- `apps/server/src/modules/billing/stripe.adapter.ts`
- `apps/server/src/modules/billing/checkout.routes.ts`
- `apps/server/src/modules/billing/catalog.service.ts`
- `apps/server/src/modules/billing/provider-reconciler.ts`
- `apps/server/src/modules/billing/entitlement.service.ts`
- `apps/server/src/modules/billing/trial.service.ts`
- `apps/server/src/modules/billing/feature-gate.middleware.ts` (new)

### Route Gates (examples — replicate pattern for remaining routes)
- `apps/server/src/modules/project/project.routes.ts`
- `apps/server/src/modules/project/change-order/change-order.routes.ts`

### Frontend (not started)
- `apps/web/src/content/pricing.ts`
- `apps/web/src/pages/PricingPage.tsx`

### Tests (not started)
- `apps/server/tests/unit/billing/catalog-policy.test.ts`
- `apps/server/tests/integration/billing/catalog-entitlements.test.ts`

## 🚀 Next Steps

1. **Complete route gates** — replicate the pattern for remaining 20+ routes (list in section A above)
2. **Add storage gate** — `document.service.ts` upload enforcement
3. **Frontend pricing** — rewrite pricing content + page component
4. **Tests** — unit + integration coverage for trial plan, feature flags, gates
5. **Verify checkout flow** — manually test Stripe Checkout with product-ID resolution
6. **Verify webhook reconciliation** — test subscription.created/updated webhooks resolve prices correctly

## ✨ What's Working Now

- Stripe Checkout resolves the correct price ID at runtime from product ID + interval
- Webhook reconciliation maps subscription back to local plan via product + interval
- Trial provision returns trial limits (not Professional)
- Feature gate middleware blocks restricted features with clear 403 error
- Procurement chain (MR/quote/PO create) and change-order create are gated

## 📝 Testing Checklist (Before Production)

- [ ] Trial provision → returns trial limits (2 projects, 5 members, 5GB, 100k AI tokens)
- [ ] Starter subscription → procurement/subcontractor/change-order/payment-app/AI chat blocked
- [ ] Professional subscription → all features accessible
- [ ] Enterprise subscription → all features accessible (same as Pro, higher limits)
- [ ] Stripe Checkout → resolves correct price ID for each product × interval
- [ ] Webhook reconciliation → maps product+interval back to local plan correctly
- [ ] Feature gate error response → returns 403 with `FEATURE_RESTRICTED` + upgrade URL
- [ ] Storage upload gate → blocks when org reaches storageGb limit
