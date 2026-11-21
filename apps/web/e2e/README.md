# E2E Tests - Subscription Flow with Stripe & Ethereal

## Overview

Comprehensive end-to-end tests for the complete subscription flow:
- ✅ Real Stripe checkout (no mocking)
- ✅ Ethereal email verification
- ✅ Chrome browser (real user flow)
- ✅ All plans: Trial, Starter, Professional, Enterprise
- ✅ Both monthly and yearly billing

## Prerequisites

### 1. Environment Variables

Create `/run/media/shahzaib/NewVolume/work/siteflow/apps/server/.env`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/siteflow_test

# Stripe (TEST MODE)
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret

# Stripe Product IDs (Test Mode)
STRIPE_PRODUCT_STARTER=prod_test_starter
STRIPE_PRODUCT_PRO=prod_test_professional
STRIPE_PRODUCT_ENT=prod_test_enterprise

# Frontend URL (with ngrok if using webhook)
FRONTEND_URL=https://your-ngrok-url.ngrok.io

# API URL
API_URL=http://localhost:3000/api/v1

# Email (Ethereal for testing)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user@ethereal.email
SMTP_PASS=your-ethereal-password
EMAIL_FROM=noreply@siteflow.com

# Ethereal API (for E2E tests to fetch emails)
ETHEREAL_PASSWORD=your-ethereal-password
```

### 2. ngrok Setup (for Stripe webhooks)

```bash
# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL and set it in:
# 1. FRONTEND_URL in .env
# 2. Stripe Dashboard webhook endpoint: https://your-ngrok-url/api/v1/billing/webhook
```

### 3. Stripe Test Products

Create test products in Stripe Dashboard (Test Mode):
1. Starter - $20/month, $216/year
2. Professional - $100/month, $1080/year  
3. Enterprise - $300/month, $3240/year

Set product IDs in `.env`

## Running Tests

### Run All Tests

```bash
cd apps/web
npx playwright test
```

### Run Specific Test

```bash
# Run only Starter tests
npx playwright test subscription/all-plans.spec.ts -g "Starter"

# Run only Trial test
npx playwright test subscription/all-plans.spec.ts -g "Trial"

# Run only yearly billing tests
npx playwright test subscription/all-plans.spec.ts -g "Yearly"
```

### Run with UI (Visual Mode)

```bash
npx playwright test --ui
```

### Run in Headed Mode (See Browser)

```bash
npx playwright test --headed
```

### Debug Specific Test

```bash
npx playwright test --debug subscription/all-plans.spec.ts -g "Professional"
```

## Test Structure

```
e2e/
├── fixtures/
│   ├── api.ts          # API request helpers
│   ├── ethereal.ts     # Email verification helpers
│   └── stripe.ts       # Stripe checkout helpers
├── subscription/
│   └── all-plans.spec.ts  # All plan tests (Trial, Starter, Pro, Enterprise)
└── README.md           # This file
```

## Test Flow

Each test follows this flow:

1. **Visit Pricing Page** → `/pricing`
2. **Click Plan CTA** → `Get started` or `Start free trial`
3. **Register** → Fill form with unique Ethereal email
4. **Email Verification** → Fetch link from Ethereal inbox
5. **Create Organization** → Fill org name
6. **Billing Flow:**
   - **Trial:** Click "Start Free Trial" button
   - **Paid Plans:** Complete Stripe checkout
7. **Wait for Webhook** → Poll billing status API
8. **Verify Subscription** → Check plan, limits, features

## Expected Results

### Trial Plan
- ✅ 14-day trial starts immediately
- ✅ No credit card required
- ✅ All Professional features available
- ✅ Limits: 2 projects, 5 members, 5GB storage, 100K AI tokens

### Starter Plan
- ✅ Requires Stripe payment
- ✅ No trial in database
- ✅ AI chat enabled (NEW fix)
- ✅ Limits: 3 projects, 10 members, 50GB storage, 100K AI tokens
- ❌ Advanced features blocked (procurement, subcontractor, etc.)

### Professional Plan
- ✅ Requires Stripe payment
- ✅ All features unlocked
- ✅ Limits: 15 projects, 50 members, 250GB storage, 500K AI tokens

### Enterprise Plan
- ✅ Requires Stripe payment
- ✅ All features unlocked
- ✅ Limits: 100 projects, 500 members, 1TB storage, 2M AI tokens

## Troubleshooting

### Test Timeouts
- Increase timeout in `playwright.config.ts`
- Stripe webhooks can take 30-60 seconds

### Ethereal Emails Not Arriving
- Check SMTP credentials in `.env`
- Verify Ethereal account is active
- Check email sending logs in backend

### Stripe Checkout Fails
- Verify test API keys are correct
- Check webhook endpoint in Stripe Dashboard
- Ensure ngrok is running and URL is up to date
- Check Stripe webhook logs for errors

### Authentication Issues
- Clear browser storage between tests
- Check auth token extraction in `getAuthToken()`

## Test Output

Tests log detailed information:

```
====== PROFESSIONAL MONTHLY TEST ======
Email: test-1234567890-abc123@ethereal.email
[Ethereal] Waiting for verification email...
[Ethereal] Found verification email (attempt 3)
[Stripe] Waiting for checkout page...
[Stripe] Filling card number...
[Stripe] Checkout completed successfully!
[Stripe Webhook] Waiting for billing state to become 'active'...
[Stripe Webhook] Billing state is 'active' (attempt 5)
[Subscription] Verified: professional (month)
✅ Professional Monthly test completed successfully!
```

## CI/CD Integration

Add to GitHub Actions:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm build
      - run: npx playwright install --with-deps chromium
      
      - name: Run E2E tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/siteflow_test
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY_TEST }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET_TEST }}
          FRONTEND_URL: http://localhost:5173
          API_URL: http://localhost:3000/api/v1
        run: npx playwright test
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Notes

- Tests use real Stripe checkout (test mode)
- Emails use Ethereal (development email service)
- Each test creates unique email: `test-{timestamp}-{random}@ethereal.email`
- Tests run sequentially (not parallel) due to Stripe webhooks
- Each test takes ~60-120 seconds to complete
