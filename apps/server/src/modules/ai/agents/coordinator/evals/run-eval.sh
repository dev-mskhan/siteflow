#!/bin/bash
# run-eval.sh - Quick evaluation runner with environment checks
#
# Usage:
#   ./apps/server/src/modules/ai/agents/coordinator/evals/run-eval.sh
#   OR
#   bash apps/server/src/modules/ai/agents/coordinator/evals/run-eval.sh

set -e

echo "🤖 Coordinator Agent Evaluation Runner"
echo "======================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found"
  echo "   Copy .env.example to .env and configure it"
  exit 1
fi

# Source .env
export $(grep -v '^#' .env | xargs)

# Check required environment variables
MISSING_VARS=()

if [ -z "$DATABASE_URL" ]; then
  MISSING_VARS+=("DATABASE_URL")
fi

if [ -z "$AI_PROVIDER" ]; then
  MISSING_VARS+=("AI_PROVIDER")
fi

if [ "$AI_PROVIDER" = "openai" ] && [ -z "$OPENAI_API_KEY" ]; then
  MISSING_VARS+=("OPENAI_API_KEY")
fi

if [ "$AI_PROVIDER" = "google" ] && [ -z "$GOOGLE_API_KEY" ]; then
  MISSING_VARS+=("GOOGLE_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "❌ Error: Missing required environment variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "   - $var"
  done
  echo ""
  echo "Please configure these in your .env file"
  exit 1
fi

# Check test credentials
if [ -z "$TEST_ORG_ID" ]; then
  echo "⚠️  Warning: TEST_ORG_ID not set, using default 'org_test'"
  export TEST_ORG_ID="org_test"
fi

if [ -z "$TEST_PROJECT_ID" ]; then
  echo "⚠️  Warning: TEST_PROJECT_ID not set, using default 'proj_test'"
  export TEST_PROJECT_ID="proj_test"
fi

if [ -z "$TEST_USER_ID" ]; then
  echo "⚠️  Warning: TEST_USER_ID not set, using default 'user_test'"
  export TEST_USER_ID="user_test"
fi

# Check if using fake provider
if [ "$AI_PROVIDER" = "fake" ]; then
  echo "⚠️  Warning: Using fake AI provider"
  echo "   This will test structure but NOT accuracy"
  echo "   For real evaluation, use 'openai' or 'google'"
  echo ""
  read -p "Continue with fake provider? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Print configuration
echo "✅ Environment Check Passed"
echo ""
echo "📋 Configuration:"
echo "   AI Provider: $AI_PROVIDER"
echo "   Organization ID: $TEST_ORG_ID"
echo "   Project ID: $TEST_PROJECT_ID"
echo "   User ID: $TEST_USER_ID"
echo ""

# Check if docker-compose services are running
echo "🐳 Checking Docker services..."
if ! docker ps | grep -q postgres; then
  echo "⚠️  Warning: PostgreSQL container not running"
  echo "   Start services with: docker-compose up -d"
  echo ""
  read -p "Try to start services? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting services..."
    docker-compose up -d
    echo "Waiting 10s for services to be ready..."
    sleep 10
  else
    echo "Please start services manually and re-run"
    exit 1
  fi
fi

echo "✅ Services running"
echo ""

# Estimate cost (if using paid provider)
if [ "$AI_PROVIDER" = "openai" ]; then
  echo "💰 Cost Estimate:"
  echo "   ~50 requests × gpt-4o-mini"
  echo "   Estimated cost: $0.50 - $1.00"
  echo ""
  read -p "Continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Run evaluation
echo "🚀 Starting evaluation..."
echo ""
pnpm tsx apps/server/src/modules/ai/agents/coordinator/evals/evaluate-coordinator.ts

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Evaluation PASSED"
  echo ""
  echo "📊 View results:"
  echo "   cat apps/server/src/modules/ai/agents/coordinator/evals/evaluation-results.json | jq ."
else
  echo "❌ Evaluation FAILED"
  echo ""
  echo "📊 Check results for details:"
  echo "   cat apps/server/src/modules/ai/agents/coordinator/evals/evaluation-results.json | jq ."
fi

exit $EXIT_CODE
