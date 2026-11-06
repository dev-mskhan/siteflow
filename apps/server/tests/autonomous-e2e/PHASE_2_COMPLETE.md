# Phase 2: Test Harness — COMPLETE ✅

**Date:** 2026-11-06  
**Status:** All 6 harness components built and committed  
**Commit:** `d2628e8`

---

## Deliverables

### 1. gemini-wrapper.ts ✅
**Purpose:** Real Gemini API calls via web2api with safety controls

**Features:**
- ✅ Connects to web2api proxy at `http://127.0.0.1:8081/v1`
- ✅ Budget tracking with hard cap enforcement
- ✅ Throws `BudgetExceededError` when cap exceeded
- ✅ Exponential backoff retry for 429 (rate limit) and 500 (server error)
- ✅ 30-second timeout per request
- ✅ Cost calculation: $0.075/1M input tokens, $0.30/1M output tokens
- ✅ Spend tracking across all test calls
- ✅ Methods: `chatCompletion()`, `getSpent()`, `getRemaining()`, `reset()`

**Usage:**
```typescript
const wrapper = new GeminiWrapper(10.0); // $10 cap
const response = await wrapper.chatCompletion({
  model: 'gemini-3.5-flash',
  messages: [{ role: 'user', content: 'Test query' }],
  temperature: 0,
});
console.log(`Spent: $${wrapper.getSpent().toFixed(4)}`);
```

---

### 2. trace-collector.ts ✅
**Purpose:** Query Langfuse API for test assertions and metrics

**Features:**
- ✅ Fetches traces by ID from Langfuse API (http://localhost:3020)
- ✅ Retry logic with exponential backoff (max 5 attempts)
- ✅ Extracts structured data:
  - Tool calls (name, args, result, status, duration, errors)
  - Token usage (input, output, total)
  - Cost tracking
  - All observations (spans, generations)
- ✅ Helper methods:
  - `containsData()` - Check for data leakage
  - `findToolCall()` - Find specific tool by name
  - `wasToolDenied()` - Check if tool was permission-denied

**Usage:**
```typescript
const collector = new TraceCollector();
const trace = await collector.getTrace(runId);
expect(trace.toolCalls).toHaveLength(3);
expect(collector.wasToolDenied(trace, 'get_financial_summary')).toBe(true);
expect(collector.containsData(trace, 'secret-data')).toBe(false);
```

---

### 3. scenario-dsl.ts ✅
**Purpose:** Declarative test scenario definitions

**Features:**
- ✅ Typed `Scenario` interface with:
  - `name`, `description`, `persona`
  - `fixtures` (setup data requirements)
  - `turns` (multi-turn conversations)
  - `assertions` per turn (no-data, permission-denied, contains, tool-called)
  - `dbAssertions` (database state checks)
  - `langfuseAssertions` (trace checks)
  - `judgeRubric` (optional semantic quality checks)
- ✅ Helper: `createScenario()` for type-safe creation
- ✅ 2 example scenarios included:
  - Cross-tenant IDOR attack
  - Binding tool approval requirement

**Usage:**
```typescript
const scenario = createScenario({
  name: 'RBAC test',
  persona: 'normal-user',
  fixtures: ['org-A', 'user-viewer'],
  turns: [
    { role: 'user', content: 'Get budget' },
    { role: 'agent', assertions: [{ type: 'permission-denied' }] },
  ],
});
```

---

### 4. judge.ts ✅
**Purpose:** LLM-as-judge for semantic quality (NOT security)

**Features:**
- ✅ Separate Gemini instance (temperature 0, structured output)
- ✅ Zod schemas for all judgments
- ✅ 4 evaluation methods:
  - `evaluateGroundedness()` - Facts present in tool outputs?
  - `evaluateHelpfulness()` - Answer addresses question?
  - `evaluateTone()` - Professional/appropriate?
  - `evaluateRouting()` - Correct agent selected?
- ✅ Calibration tracking with `recordCalibration()`
- ✅ Cohen's kappa calculation (≥20 samples required)
- ✅ Independent budget tracking

**Usage:**
```typescript
const judge = new Judge(5.0); // $5 budget
const result = await judge.evaluateGroundedness({
  question: 'What is the budget?',
  answer: 'Budget is $1M',
  toolOutputs: [{ budget: 1000000 }],
});
expect(result.grounded).toBe(true);
```

**⚠️ RULE:** Judge is ONLY for semantic quality. Security/side-effect assertions remain deterministic.

---

### 5. persona-simulator.ts ✅
**Purpose:** Multi-turn conversation patterns for realistic testing

**Features:**
- ✅ 6 personas implemented:
  - `angry-superintendent` - Demanding, urgent (3 turns)
  - `confused-subcontractor` - Clarifying questions (3 turns)
  - `cfo` - Financial queries + executive summary (4 turns)
  - `malicious-insider` - Cross-tenant attacks (3 turns)
  - `external-attacker` - SQL injection, XSS, prompt extraction (3 turns)
  - `normal-user` - Standard queries (3 turns)
- ✅ Context interpolation (replace `{projectId}` etc.)
- ✅ Helper: `getPersonaDescription()` for logging

**Usage:**
```typescript
const turns = generatePersonaConversation({
  persona: 'malicious-insider',
  context: { targetProjectId: 'org-A-proj-123' },
});
// Returns: 3 turns with attack attempts
```

---

### 6. stats.ts ✅
**Purpose:** Statistical analysis for test reports

**Features:**
- ✅ **Wilson 95% CI** for rates (block rate, pass rate, routing accuracy)
- ✅ **Percentiles** (p50, p95, p99) for latency/cost
- ✅ **Pass@k** tracking (run k times, allow variance)
- ✅ **Mean/StdDev/Min/Max** calculation
- ✅ **Chi-squared test** for routing distribution
- ✅ Formatting helpers: `formatStats()`, `formatRate()`

**Usage:**
```typescript
const [lower, upper] = wilsonCI(45, 50); // 45 successes in 50 trials
// Result: [77.3%, 96.2%] 95% CI

const percentiles = calculatePercentiles([100, 200, 150, 300, 250]);
// Result: { p50: 200, p95: 300, p99: 300 }

const passAtK = calculatePassAtK([true, true, false, true]); // 3/4 passed
// Result: { k: 4, passes: 3, passRate: 0.75, ci: [19.4%, 99.4%] }
```

---

## File Structure

```
apps/server/tests/autonomous-e2e/harness/
├── gemini-wrapper.ts       (216 lines) - Real API + budget tracking
├── trace-collector.ts      (144 lines) - Langfuse query + assertions
├── scenario-dsl.ts         (102 lines) - Declarative test scenarios
├── judge.ts                (257 lines) - LLM-as-judge (semantic only)
├── persona-simulator.ts    (123 lines) - Multi-turn conversations
├── stats.ts                (181 lines) - Statistical analysis
└── index.ts                (18 lines)  - Barrel export

Total: 1,041 lines of harness code
```

---

## Integration Points

### With Real Gemini (web2api)
```typescript
// All tests will call:
OPENAI_BASE_URL=http://127.0.0.1:8081/v1
OPENAI_API_KEY=sk-your-key
AI_MODEL_CHEAP=gemini-3.5-flash
AI_MODEL_STRONG=gemini-3.7-flash
```

### With Langfuse
```typescript
// Trace collector queries:
LANGFUSE_HOST=http://localhost:3020
LANGFUSE_PUBLIC_KEY=pk-lf-71d13f4d-2816-49e1-88cc-2c531d3589df
LANGFUSE_SECRET_KEY=sk-lf-e9f975cc-542d-40cf-b7c4-706740cec022
```

### With AI Module
```typescript
import { executeTool } from '../../../src/modules/ai/tools/tool-factory.js';
import { RunContext } from '../../../src/modules/ai/core/run-context.js';
// Tests call agent functions directly (no worker needed)
```

---

## Budget Caps (As Specified)

| Suite | Budget Cap | Tests | Expected Spend |
|-------|------------|-------|----------------|
| CRITICAL | $1.00 | ~20 | $0.80-1.00 |
| FULL | $10.00 | 200+ | $8-10 |
| CHAOS | $20.00 | 300+ | $15-20 |

**Hard enforcement:** Tests abort when cap exceeded (BudgetExceededError)

---

## Next Steps

✅ **Phase 2 COMPLETE** — Harness ready for test writing  
⏭️ **Phase 3: Write Test Suites A1-A10** (10 hours estimated)

**Test suites to build:**
- A1: Tenancy (20 tests) - Cross-org attacks
- A2: RBAC (40 tests) - Role × tool matrix
- A3: Injection (50 × 3 runs = 150) - Prompt injection library
- A4: Output Safety (15 tests) - PII redaction
- A5: Input Validation (30 tests) - Fuzz all schemas
- A6: Binding/HITL (25 tests) - Approval flow end-to-end
- A7: Memory (20 tests) - Isolation + learning loop
- A8: Coordinator (60 tests) - Routing accuracy
- A9: Multimodal (20 tests) - OCR/vision/voice
- A10: Resilience (30 tests) - Errors, loops, crashes

**Total:** 200+ tests with real Gemini + full Langfuse tracing

---

**Last Updated:** 2026-11-06  
**Status:** Ready for Phase 3

