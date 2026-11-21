#!/bin/bash
#
# Verify E2E Test Setup
# Checks that all prerequisites are met before running tests
#

echo "🔍 Verifying E2E Test Setup..."
echo ""

ERRORS=0

# Check Playwright is installed
echo "✓ Checking Playwright..."
if npx playwright --version > /dev/null 2>&1; then
  VERSION=$(npx playwright --version)
  echo "  ✅ Playwright installed: $VERSION"
else
  echo "  ❌ Playwright not installed"
  echo "     Run: pnpm add -D @playwright/test"
  ERRORS=$((ERRORS + 1))
fi

# Check environment variables
echo ""
echo "✓ Checking environment variables..."

if [ -f "../../server/.env" ]; then
  echo "  ✅ .env file exists"
  
  # Check critical vars
  if grep -q "STRIPE_SECRET_KEY" ../../server/.env; then
    echo "  ✅ STRIPE_SECRET_KEY configured"
  else
    echo "  ❌ STRIPE_SECRET_KEY missing in .env"
    ERRORS=$((ERRORS + 1))
  fi
  
  if grep -q "STRIPE_WEBHOOK_SECRET" ../../server/.env; then
    echo "  ✅ STRIPE_WEBHOOK_SECRET configured"
  else
    echo "  ❌ STRIPE_WEBHOOK_SECRET missing in .env"
    ERRORS=$((ERRORS + 1))
  fi
  
  if grep -q "ETHEREAL" ../../server/.env; then
    echo "  ✅ Ethereal config found"
  else
    echo "  ⚠️  Ethereal config not found (may use default)"
  fi
else
  echo "  ❌ .env file not found at apps/server/.env"
  ERRORS=$((ERRORS + 1))
fi

# Check backend is running
echo ""
echo "✓ Checking backend..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "  ✅ Backend is running on http://localhost:3000"
else
  echo "  ❌ Backend not running"
  echo "     Start with: cd apps/server && pnpm dev"
  ERRORS=$((ERRORS + 1))
fi

# Check ngrok
echo ""
echo "✓ Checking ngrok..."
if curl -s http://127.0.0.1:4040/api/tunnels > /dev/null 2>&1; then
  NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok\.io' | head -1)
  if [ -n "$NGROK_URL" ]; then
    echo "  ✅ ngrok running: $NGROK_URL"
    echo "     ⚠️  Make sure this URL is set in:"
    echo "         1. FRONTEND_URL in .env"
    echo "         2. Stripe webhook endpoint"
  else
    echo "  ⚠️  ngrok running but no HTTPS tunnel found"
  fi
else
  echo "  ❌ ngrok not running"
  echo "     Start with: ngrok http 3000"
  ERRORS=$((ERRORS + 1))
fi

# Check Stripe products
echo ""
echo "✓ Checking Stripe test products..."
echo "  ⚠️  Manual check required:"
echo "     1. Go to Stripe Dashboard (Test Mode)"
echo "     2. Verify products exist: Starter, Professional, Enterprise"
echo "     3. Verify webhook endpoint configured"
echo "     4. Verify webhook events selected"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo "✅ All checks passed! Ready to run tests."
  echo ""
  echo "Run tests with:"
  echo "  pnpm test:e2e              # Run all tests"
  echo "  pnpm test:e2e:ui           # Interactive UI mode"
  echo "  pnpm test:e2e:headed       # See browser"
  echo "  pnpm test:e2e:debug        # Debug mode"
else
  echo "❌ $ERRORS error(s) found. Fix issues above before running tests."
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
