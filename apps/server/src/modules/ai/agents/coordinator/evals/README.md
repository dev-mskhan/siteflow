# Coordinator Agent Evaluation

This directory contains the evaluation framework for measuring coordinator agent routing accuracy.

## Overview

The coordinator agent routes user questions to specialized agents (compliance, estimating-boq, cost-financial, procurement, reports). This evaluation measures how accurately it makes routing decisions.

## Files

- **`evaluate-coordinator.ts`** - Main evaluation script
- **`evaluation-results.json`** - Output file with results (generated after run)
- **`../../../../../.planning/coordinator-evaluation-dataset.json`** - 50 test cases with ground truth

## Dataset

The evaluation uses 50 carefully crafted test cases:
- **10 cases per agent** (compliance, estimating-boq, cost-financial, procurement, reports)
- **Balanced difficulty**: 20 easy, 26 medium, 4 hard
- **Ground truth labels**: Each question has expected agent

## Prerequisites

### 1. Environment Setup

Create a test environment in your `.env`:

```bash
# Test Organization and Project IDs
TEST_ORG_ID=org_<your-test-org-id>
TEST_PROJECT_ID=proj_<your-test-project-id>
TEST_USER_ID=user_<your-test-user-id>
```

### 2. Database & Services

Ensure all services are running:

```bash
# Start infrastructure (PostgreSQL, Redis, MinIO)
docker-compose up -d

# Run database migrations
pnpm db:push

# Seed test data if needed
pnpm db:seed
```

### 3. AI Provider

Configure AI provider in `.env`:

**Option A: Fake Provider (Local Development - No Cost)**
```bash
AI_PROVIDER=fake
```
⚠️ **Note**: Fake provider returns mock responses. Use for structure testing, NOT accuracy measurement.

**Option B: OpenAI (Recommended for Accuracy Testing)**
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```
💰 **Cost estimate**: ~$0.50-$1.00 for 50 test cases with gpt-4o-mini

**Option C: Google Gemini**
```bash
AI_PROVIDER=google
GOOGLE_API_KEY=...
```

### 4. Langfuse (Optional - for observability)

```bash
LANGFUSE_HOST=http://localhost:3020
LANGFUSE_PUBLIC_KEY=pk-lf-siteflow-dev
LANGFUSE_SECRET_KEY=sk-lf-siteflow-dev
```

## Running the Evaluation

### Quick Start

```bash
# From workspace root
pnpm tsx apps/server/src/modules/ai/agents/coordinator/evals/evaluate-coordinator.ts
```

### Expected Output

```
🤖 Coordinator Agent Evaluation
================================

📂 Loading evaluation dataset...
✅ Loaded 50 test cases
📊 Target accuracy: 90.0%
🎯 By agent: {
  "compliance": 10,
  "estimating-boq": 10,
  "cost-financial": 10,
  "procurement": 10,
  "reports": 10
}

🚀 Starting evaluation...

[1/50] Testing: "What permits are required for this construction project..."
   ✅ Expected: compliance, Got: compliance (2345ms)
[2/50] Testing: "Show me the OSHA safety requirements for working at heigh..."
   ✅ Expected: compliance, Got: compliance (2123ms)
...

📊 Computing statistics...

════════════════════════════════════════════════════════
                  EVALUATION SUMMARY
════════════════════════════════════════════════════════

📅 Timestamp: 2026-11-05T10:30:00.000Z
📊 Total test cases: 50
✅ Correct routings: 46
❌ Incorrect routings: 3
💥 Failed runs: 1
🎯 Accuracy: 92.00%
🎯 Target: 90.00%
⏱️  Average response time: 2456ms

✅ PASSED

📊 By Difficulty:
   easy    : 20/20 (100.0%)
   medium  : 23/26 (88.5%)
   hard    : 3/4 (75.0%)

📊 By Agent:
   compliance          : 9/10 (90.0%)
   estimating-boq      : 10/10 (100.0%)
   cost-financial      : 9/10 (90.0%)
   procurement         : 10/10 (100.0%)
   reports             : 8/10 (80.0%)

════════════════════════════════════════════════════════

💾 Results saved to: apps/server/src/modules/ai/agents/coordinator/evals/evaluation-results.json
```

### Exit Codes

- **0** - Evaluation passed (accuracy ≥ 90%)
- **1** - Evaluation failed or error occurred

## Configuration

Edit `CONFIG` in `evaluate-coordinator.ts`:

```typescript
const CONFIG = {
  organizationId: process.env.TEST_ORG_ID || 'org_test',
  projectId: process.env.TEST_PROJECT_ID || 'proj_test',
  userId: process.env.TEST_USER_ID || 'user_test',
  datasetPath: '../../../../../../.planning/coordinator-evaluation-dataset.json',
  outputPath: './evaluation-results.json',
  delayBetweenRequests: 1000, // ms between requests
  maxRetries: 2,
};
```

## Analyzing Results

### View Detailed Results

```bash
# Pretty print JSON results
cat apps/server/src/modules/ai/agents/coordinator/evals/evaluation-results.json | jq .
```

### Key Metrics

1. **Overall Accuracy** - Percentage of correct routings
2. **By Difficulty** - Performance on easy/medium/hard cases
3. **By Agent** - Accuracy per specialist agent
4. **Average Response Time** - End-to-end latency
5. **Misclassified Examples** - Failed cases for debugging

### Common Issues

**Low accuracy (<90%)**:
- Check if using real AI provider (not fake)
- Review coordinator prompt for clarity
- Examine misclassified examples in output
- Consider prompt refinement or examples

**High response times (>5s average)**:
- Check sub-run timeout settings
- Verify specialist agents are responsive
- Consider model tier (cheap vs default vs powerful)

**Failed runs**:
- Check database connectivity
- Verify organization/project IDs exist
- Ensure all specialist agents are registered
- Review error messages in results.json

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Coordinator Evaluation

on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: siteflow_test
          POSTGRES_USER: siteflow
          POSTGRES_PASSWORD: siteflow
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      
      - run: pnpm db:push
      
      - name: Run Coordinator Evaluation
        env:
          AI_PROVIDER: openai
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TEST_ORG_ID: ${{ secrets.TEST_ORG_ID }}
          TEST_PROJECT_ID: ${{ secrets.TEST_PROJECT_ID }}
          DATABASE_URL: postgres://siteflow:siteflow@localhost:5432/siteflow_test
        run: |
          pnpm tsx apps/server/src/modules/ai/agents/coordinator/evals/evaluate-coordinator.ts
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: evaluation-results
          path: apps/server/src/modules/ai/agents/coordinator/evals/evaluation-results.json
```

## Improving Accuracy

### 1. Review Misclassifications

Look at `misclassified examples` in results:
```bash
cat evaluation-results.json | jq '.results[] | select(.isCorrect == false)'
```

### 2. Update Coordinator Prompt

Edit `apps/server/src/modules/ai/agents/coordinator/prompts.ts`:
- Add more routing examples
- Clarify agent responsibilities
- Add disambiguation rules

### 3. Refine Dataset

Edit `.planning/coordinator-evaluation-dataset.json`:
- Add edge cases
- Balance difficulty distribution
- Add ambiguous questions

### 4. Adjust Model Tier

In `apps/server/src/modules/ai/core/agent-registry.ts`:
```typescript
// Current: cheap tier (gpt-4o-mini)
tier: 'cheap',

// For better accuracy:
tier: 'default', // gpt-4o or gemini-1.5-pro
```

## Target Accuracy

**Minimum required**: 90%
**Industry benchmark**: 92-95%
**Excellent**: 95%+

Coordinator is a classification task, so high accuracy (>90%) is achievable and expected.

## Next Steps After Evaluation

1. ✅ If accuracy ≥ 90%: Mark task complete, move to Wave 5
2. ❌ If accuracy < 90%: Debug misclassifications, refine prompt, re-run
3. 📊 Monitor production accuracy with Langfuse traces
4. 🔄 Update dataset with real user questions over time

## Support

For issues or questions:
- Check logs: `docker-compose logs -f server`
- Review Langfuse traces: http://localhost:3020
- Examine error messages in `evaluation-results.json`
