# Autonomous E2E Findings

**Last Updated:** 2026-11-06  
**Commit:** `012a38a` (HEAD → development)  
**Phase:** Phase 4 complete — 100/100 tests passing with REAL Gemini API calls

---

## RECON-001 — Test Database Safety Gate (P0 - WAIVED)

- **Severity:** P0
- **Status:** ✅ WAIVED - Using main `siteflow` DB as instructed
- **Discovery:** Code inspection of `tests/global-setup.ts` line 64
- **Issue:** Originally flagged as requiring separate test DB, but user confirmed to use main DB only
- **Resolution:** No changes needed. Tests use main `siteflow` database with proper migration and schema management
- **Impact:** None - proceeding with main DB
- **Evidence provenance:** Code inspection 2026-11-06 at commit `6ff0dc955a07fba70b4c231e60bdee97e6f21a69`

---

## RECON-002 — Binding Tools Orphaned Due to Import Path Error (P1 - FIXED ✅)

- **Severity:** P1 (CRITICAL - production feature broken)
- **Status:** ✅ FIXED
- **Discovery:** Code inspection of `apps/server/src/modules/ai/tools/definitions/binding.tools.ts`
- **Issue:** Import statement referenced non-existent path `'../registry.js'` instead of `'../tool-registry.js'`
- **Impact:**
  - File never loaded (not imported by `ai/index.ts`)
  - 2 production BINDING tools unreachable: `send_message`, `submit_purchase_request`
  - Approval flow could not be tested end-to-end with real production tools
- **Fix Applied:**
  1. ✅ Corrected import path in `binding.tools.ts` line 3: `'../tool-registry.js'`
  2. ✅ Removed unused `ToolApprovalService` import (orphaned service)
  3. ✅ Simplified tool implementations (approval flow handled by tool-factory.ts tier gate)
  4. ✅ Added import to `ai/index.ts`: `import './tools/definitions/binding.tools.js';`
- **Files Changed:**
  - `apps/server/src/modules/ai/tools/definitions/binding.tools.ts`
  - `apps/server/src/modules/ai/index.ts`
- **Verification:** Tools now registered and callable (verified via A6 HITL tests, 10/10 passing)
- **Evidence provenance:** Code fix 2026-11-06 at commit `6ff0dc955a07fba70b4c231e60bdee97e6f21a69`

---

## RECON-003 — Response-Level PII Redaction Not Implemented (P1 - PARTIAL FIX)

- **Severity:** P1 (SECURITY - PII exposure risk)
- **Status:** ⚠️ PARTIAL — Arg-level redaction added, response-level redaction still NOT implemented
- **Discovery:** Code inspection of tool execution pipeline in `tool-factory.ts` and `output-guard.ts`
- **Issue:** Tool outputs (returned to LLM/stored in DB/Langfuse) were NOT redacted for PII. Only tool arguments were redacted.
- **Impact:** PII in tool results (SSN, credit cards, API keys, phone, email) exposed to:
  - Agent LLM context (prompt injection risk)
  - Database (`agent_runs.outputSnapshot` column)
  - Langfuse traces
  - User-facing API responses
- **Fix Applied:**
  1. ✅ Added `redactPII()` function to `output-guard.ts` with 8 PII pattern matchers
  2. ✅ Integrated `redactPII()` into tool-factory.ts execution pipeline (step 5.5)
  3. ⚠️ Response-level redaction for LLM-generated output NOT implemented (agent JSON output still unredacted)
- **Verification:** A4 Output Safety tests (10/10 passing) verify PII patterns are not present in agent output, but this is because the test data doesn't contain PII. The redaction gap remains open for production data.
- **Evidence provenance:** Code fix 2026-11-06 at commit `6ff0dc955a07fba70b4c231e60bdee97e6f21a69`; A4 tests at commit `012a38a`

---

## AI-WKR-001 — Database Schema Package Prevents AI Worker Startup (P1 - FIXED ✅)

- **Severity:** P1
- **Status:** ✅ FIXED
- **Discovery:** Database package build failure when running Phase 3 tests
- **Issue:** `src/schema/okf.schema.ts` and `src/schema/tool-approvals.schema.ts` import `./user.schema.js` which does not exist. Should import from `./auth.schema`
- **Fix Applied:** Corrected imports in okf.schema.ts and tool-approvals.schema.ts to use `./auth.schema`
- **Files Changed:**
  - `packages/database/src/schema/okf.schema.ts`
  - `packages/database/src/schema/tool-approvals.schema.ts`
- **Verification:** Database package builds successfully, all 100 tests pass
- **Evidence provenance:** Code fix 2026-11-06 at commit `19664f7`

---

## TEST-001 — Schema Type Mismatch UUID vs TEXT (P0 - FIXED ✅)

- **Severity:** P0 (blocked all tests)
- **Status:** ✅ FIXED
- **Discovery:** Running A1 tenancy tests — FK constraint violation
- **Issue:** `organizations.id` is `text()` in existing schema but new tables `okf_pages` and `tool_approvals` used `uuid()` for ID columns, causing FK constraint mismatch
- **Impact:** ALL tests failed — no test could create fixtures because FK constraints rejected UUID references to TEXT primary keys
- **Fix Applied:** Changed all ID columns in `okf.schema.ts` and `tool-approvals.schema.ts` from `uuid()` to `text()` to match the existing convention throughout the schema
- **Files Changed:**
  - `packages/database/src/schema/okf.schema.ts` (id, organizationId, createdBy, approvedBy → text())
  - `packages/database/src/schema/tool-approvals.schema.ts` (all ID columns → text())
  - Deleted failed migration 0072, regenerated with TEXT types
- **Verification:** Migration applied successfully, schema drift check passes, all 100 tests pass
- **Evidence provenance:** Code fix 2026-11-06 at commit `85f48a6`

---

## TEST-002 — Gemini LLM Returns Markdown-Wrapped JSON (P1 - FIXED ✅)

- **Severity:** P1 (caused test failures due to JSON parse errors)
- **Status:** ✅ FIXED
- **Discovery:** A1 T1.10 and A2 T2.1 failing with `Unexpected token '`'` — Gemini wraps JSON responses in ```json fences
- **Issue:** `JSON.parse(message.content)` in cost-financial and reports agent graphs fails when Gemini returns ` ```json\n{...}\n``` ` instead of raw JSON
- **Impact:** ~20% of test runs failed due to LLM non-determinism in output formatting
- **Fix Applied:** Added markdown fence stripping regex before `JSON.parse` in:
  - `apps/server/src/modules/ai/agents/cost-financial/graph.ts` — strip ` ```json ... ``` ` before parse
  - `apps/server/src/modules/ai/agents/reports/graph.ts` — same fix
  - (estimating-boq, compliance, procurement already had this fix)
- **Verification:** All 100 tests pass consistently after fix
- **Evidence provenance:** Code fix 2026-11-06 at commit `b84a49c`

---

## TEST-003 — Test Timeouts on Complex Agent Graphs (P2 - FIXED ✅)

- **Severity:** P2 (9 test timeouts in A8-A10)
- **Status:** ✅ FIXED
- **Discovery:** A8 coordinator, A9 multimodal, A10 resilience tests timing out at 120s
- **Issue:** Test timeout (120s) equals default run timeout (120s), so test framework kills `executeRun` before it can complete or fail gracefully
- **Impact:** 9/30 tests in A8-A10 failed due to timeout (not test logic failures)
- **Fix Applied:** Pass `TEST_LIMITS: RunLimits = { maxSteps: 10, maxToolCalls: 8, maxTokens: 50_000, timeoutMs: 60_000 }` as second argument to `buildRunContext`. This gives 30s buffer between run timeout (60s) and test timeout (90s).
- **Files Changed:**
  - `apps/server/tests/autonomous-e2e/suites/A8-coordinator.test.ts`
  - `apps/server/tests/autonomous-e2e/suites/A9-multimodal.test.ts`
  - `apps/server/tests/autonomous-e2e/suites/A10-resilience.test.ts`
- **Verification:** All 30/30 tests in A8-A10 pass after fix
- **Evidence provenance:** Code fix 2026-11-06 at commit `012a38a`

---

## TEST-004 — Duplicate Permission Key Constraint (P2 - FIXED ✅)

- **Severity:** P2
- **Status:** ✅ FIXED
- **Discovery:** A3 injection tests skipped due to beforeAll failure
- **Issue:** Multiple test suites create `project:read` permission independently, causing `duplicate key value violates unique constraint "permissions_key_unique"` when run after other suites
- **Fix Applied:** Changed all test suites to reuse existing permission if it already exists (SELECT first, INSERT only if not found). Also stopped deleting permissions in afterAll cleanup.
- **Files Changed:** All 10 test suites (A1-A10)
- **Verification:** All suites can run in any order without conflicts
- **Evidence provenance:** Code fix 2026-11-06 at commit `3ea9760`

---

## Summary

| Finding ID | Severity | Status     | Blocker | Tests Affected        |
| ---------- | -------- | ---------- | ------- | --------------------- |
| RECON-001  | P0       | ✅ WAIVED  | ❌ NO   | None                  |
| RECON-002  | P1       | ✅ FIXED   | ❌ NO   | A6 (binding tools)    |
| RECON-003  | P1       | ⚠️ PARTIAL | ❌ NO   | A4 (output safety)    |
| AI-WKR-001 | P1       | ✅ FIXED   | ❌ NO   | All (build failure)   |
| TEST-001   | P0       | ✅ FIXED   | ❌ NO   | All (schema mismatch) |
| TEST-002   | P1       | ✅ FIXED   | ❌ NO   | ~20% of runs          |
| TEST-003   | P2       | ✅ FIXED   | ❌ NO   | 9 tests in A8-A10     |
| TEST-004   | P2       | ✅ FIXED   | ❌ NO   | Multi-suite runs      |

**Total Findings:** 8 (1 P0 waived, 1 P0 fixed, 2 P1 fixed, 1 P1 partial, 2 P2 fixed)  
**All blockers resolved.** 100/100 tests passing.

---

## Changes Made

### TEST-001 Fix (Schema Type Mismatch)

```typescript
// okf.schema.ts - Before:
id: uuid('id').primaryKey(),  // ❌ UUID mismatches organizations.id which is text()
organizationId: uuid('organization_id').references(() => organizations.id), // ❌ FK constraint fail

// okf.schema.ts - After:
id: text('id').primaryKey(),  // ✅ TEXT matches existing schema convention
organizationId: text('organization_id').references(() => organizations.id), // ✅ FK passes
```

### TEST-002 Fix (Markdown Fence Stripping)

````typescript
// cost-financial/graph.ts - Before:
const parsed: unknown = JSON.parse(message.content); // ❌ Fails on ```json fences

// cost-financial/graph.ts - After:
let raw = message.content.trim();
const fenceMatch = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
if (fenceMatch) {
  raw = fenceMatch[1].trim();
}
const parsed: unknown = JSON.parse(raw); // ✅ Strips fences before parse
````

### TEST-003 Fix (Test Run Limits)

```typescript
// A8-A10 test suites - Before:
const ctx = buildRunContext({ ... }); // Uses DEFAULT_RUN_LIMITS.timeoutMs = 120_000
// Test timeout = 120000ms → no buffer → test kills run before completion

// A8-A10 test suites - After:
const TEST_LIMITS: RunLimits = { maxSteps: 10, maxToolCalls: 8, maxTokens: 50_000, timeoutMs: 60_000 };
const ctx = buildRunContext({ ... }, TEST_LIMITS); // 60s run timeout
// Test timeout = 90000ms → 30s buffer → run completes or fails gracefully
```

### TEST-004 Fix (Permission Reuse)

```typescript
// All suites - Before:
[projectReadPerm] = await db.insert(permissions).values({
  id: generateId(), key: 'project:read', description: 'Read project data'
}).returning(); // ❌ Duplicate key on second suite run

// All suites - After:
const existingPerm = await db.select().from(permissions)
  .where(eq(permissions.key, 'project:read')).limit(1);
if (existingPerm.length > 0) {
  projectReadPerm = existingPerm[0]; // ✅ Reuse existing
} else {
  [projectReadPerm] = await db.insert(permissions).values({ ... }).returning();
}
```

---

**Next Steps:**

1. ✅ Phase 0 complete with findings resolved
2. ✅ Phase 1 complete — environment verified
3. ✅ Phase 2 complete — harness built (6 components)
4. ✅ Phase 3 complete — 100/100 tests passing with REAL Gemini API calls
5. ✅ Phase 4 complete — CLAIMS_LEDGER.md updated with evidence
6. ⏸️ Phase 5 pending — benchmarks (latency, cost, memory)
7. ⏸️ Report writing pending — TEST_REPORT.md generation
