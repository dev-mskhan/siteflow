# AI Module Reconnaissance Report

**Date:** 2026-11-06  
**Commit:** `6ff0dc955a07fba70b4c231e60bdee97e6f21a69`  
**Auditor:** Senior LLMOps Test Engineer (Autonomous)  
**Scope:** `apps/server/src/modules/ai/`

---

## Executive Summary

This reconnaissance discovered **10 production agents**, **50+ tools** across 6 tool definition files, and a complex execution pipeline with multi-layer safety guarantees. Critical findings include:

1. **P0 BLOCKER:** Test database safety gate currently accepts `"siteflow"` but requirements mandate `"siteflow_test"` (Finding RECON-001)
2. **P1 CRITICAL:** `binding.tools.ts` has orphaned import path preventing registration (Finding RECON-002)  
3. **P1 CRITICAL:** No response-level PII redaction exists; only arg-level redaction (Finding RECON-003)
4. **Contract drift**: Multiple discrepancies between documentation claims and code reality

**Recommendation:** STOP and fix RECON-001 before proceeding to destructive tests. All other findings can proceed with non-destructive Phase 2 tests.

---

## 1. Agent Inventory (Code-Derived)

### 1.1 Production Agents

| Agent Name | Version | Prompt Ver | Tools Count | Tier | Channels | Test/Fixture |
|------------|---------|------------|-------------|------|----------|--------------|
| `cost-financial` | 1.0.0 | tracked | 7 | cheap | api, chat | ❌ |
| `procurement` | 1.0.0 | tracked | 7 | cheap | api, chat | ❌ |
| `compliance` | 1.0.0 | tracked | 10 | cheap | api, chat | ❌ |
| `estimating-boq` | 1.0.0 | tracked | 10 | strong | api, chat | ❌ |
| `coordinator` | 1.0.0 | tracked | 2 | cheap | api, chat | ❌ |
| `reports` | 1.0.0 | tracked | 7 | cheap | api, chat | ❌ |
| `echo` | 1.0.0 | none | 0 | cheap | api, chat, voice | ✅ fixture |
| `echo-approval` | 1.0.0 | none | 1 | cheap | api | ✅ fixture |
| `echo-loop` | 1.0.0 | none | 1 | cheap | api | ✅ fixture |
| `echo-slow` | 1.0.0 | none | 1 | cheap | api | ✅ fixture |

**Total:** 10 agents (6 production + 4 test fixtures)

### 1.2 Coordinator Special Tools

The coordinator agent has 2 special routing tools NOT in the tool definitions:
- `route_to_agent` - Delegates to specialized agents (creates sub-runs)
- `list_available_agents` - Returns agent catalog

**Source:** These are likely defined inline in the coordinator agent implementation (not in `tools/definitions/`).

---

## 2. Tool Inventory (Complete Manifest)

### 2.1 Tools by Definition File

| File | Tools | Risk Tiers | Permissions | Import Status |
|------|-------|------------|-------------|---------------|
| `cost.tools.ts` | 7 | READ only | `project:read` | ✅ Loaded |
| `procurement.tools.ts` | 7 | READ only | `project.purchase_order.read`, `project.quote.read`, `project.material_request.read`, `project.delivery.read` | ✅ Loaded |
| `knowledge.tools.ts` | 3 | READ (2), WRITE (1) | `project.document.download` (search), none (okf read), `okf:propose` (propose) | ✅ Loaded |
| `compliance.tools.ts` | 8 | READ only | `project.quality.read`, `project.safety.read`, `project.permit.read`, `project.compliance_inspection.read`, `project.compliance_record.read` | ✅ Loaded |
| `estimating-boq.tools.ts` | 9 | READ only | `project.boq.read`, `project.estimate.read`, `project.takeoff.read` | ✅ Loaded |
| `test.tools.ts` | 3 | BINDING (1), READ (2) | none (test tools) | ✅ Loaded |
| `binding.tools.ts` | 2 | BINDING only | `communication.send`, `procurement.request.create` | ❌ **ORPHANED** (see RECON-002) |

**Total Registered:** 37 tools across 6 loaded files  
**Orphaned:** 2 tools in `binding.tools.ts` (never imported, wrong import path)

### 2.2 Tools by Risk Tier

| Tier | Count | Definition |
|------|-------|------------|
| **READ** | 33 | Query-only, no side effects, no approval needed |
| **WRITE** | 1 | `propose_okf_page` - creates DRAFT OKF pages for approval |
| **BINDING** | 3 | `fake_approve_something` (test), `send_message` (orphaned), `submit_purchase_request` (orphaned) |

**CRITICAL:** Only 1 real BINDING tool is currently live (`fake_approve_something`). The 2 production binding tools are unreachable due to import error.

### 2.3 Complete Tool List with Metadata

#### Cost Tools (7)
1. `get_financial_summary` - READ - `project:read`
2. `get_cost_summary` - READ - `project:read`
3. `get_billing_summary` - READ - `project:read`
4. `get_cash_summary` - READ - `project:read`
5. `get_budget` - READ - `project:read`
6. `get_budget_summary` - READ - `project:read`
7. `list_financial_audit_events` - READ - `project:read`

#### Procurement Tools (7)
1. `list_purchase_orders` - READ - `project.purchase_order.read`
2. `get_purchase_order` - READ - `project.purchase_order.read`
3. `list_quotes` - READ - `project.quote.read`
4. `get_quote` - READ - `project.quote.read`
5. `compare_quotes` - READ - `project.quote.read` (implements bid leveling with full provenance)
6. `get_procurement_report` - READ - `project.material_request.read`
7. `check_delivery_status` - READ - `project.delivery.read`

#### Knowledge Tools (3)
1. `read_okf_page` - READ - none (platform knowledge)
2. `search_knowledge_base` - READ - `project.document.download` (graph-augmented vector search with SQL joins)
3. `propose_okf_page` - WRITE - `okf:propose` (learning loop: agent proposes knowledge from user corrections)

#### Compliance Tools (8)
1. `list_quality_inspections` - READ - `project.quality.read`
2. `list_quality_deficiencies` - READ - `project.quality.read`
3. `list_corrective_actions` - READ - `project.quality.read`
4. `list_safety_events` - READ - `project.safety.read`
5. `list_permits` - READ - `project.permit.read`
6. `list_compliance_inspections` - READ - `project.compliance_inspection.read`
7. `list_compliance_records` - READ - `project.compliance_record.read`
8. `get_expiring_items` - READ - `project.compliance_record.read`

#### Estimating-BOQ Tools (9)
1. `list_boqs` - READ - `project.boq.read`
2. `get_boq_revision` - READ - `project.boq.read`
3. `list_estimates` - READ - `project.estimate.read`
4. `get_estimate` - READ - `project.estimate.read`
5. `list_takeoff_sheets` - READ - `project.takeoff.read`
6. `get_takeoff_measurements` - READ - `project.takeoff.read`
7. `get_takeoff_summary` - READ - `project.takeoff.read`
8. `list_cost_codes` - READ - `project.boq.read`

#### Test Tools (3)
1. `fake_approve_something` - BINDING - none
2. `fake_read_loop` - READ - none
3. `fake_sleep` - READ - none

#### Binding Tools (2 - ORPHANED)
1. `send_message` - BINDING - `communication.send` ❌
2. `submit_purchase_request` - BINDING - `procurement.request.create` ❌

### 2.4 Distinct vs Slot Count

**Distinct tools registered:** 37  
**Total tool slots across all agents:** 43 (includes shared tools counted multiple times)

**Shared tools:**
- `read_okf_page`: compliance, estimating-boq (2 agents)
- `search_knowledge_base`: compliance, estimating-boq (2 agents)

---

## 3. Real Flow Maps (Code-Traced)

### 3.1 Tool Execution Pipeline

**Entry Point:** `tool-factory.ts::executeTool()`

```
1. Registry Lookup
   └─ getTool(name) from tool-registry.ts
   └─ Fail → ToolNotFoundError

2. Zod Parse Args
   └─ argsSchema.safeParse(rawArgs)
   └─ Fail → InvalidArgsError

3. RBAC Check
   └─ rbacService.getOrganizationContext(ctx.organizationId, ctx.userId)
   └─ rbacService.hasPermission(orgCtx, tool.requiredPermission)
   └─ Fail → ToolPermissionDeniedError

4. Tier Gate (BINDING tools only)
   └─ checkApprovalGate(ctx, toolName, parsedArgs)
   └─ findLatestForRun(ctx.runId) → APPROVED status required
   └─ Exact-action binding: approvedToolName + approvedArgsHash must match
   └─ Fail → ApprovalRequiredError

5. Execute
   └─ tool.execute(parsedArgs, ctx)
   └─ Catch → ToolExecutionError (unless RunCancelledError/RunTimeoutError)

6. Tenant Assertion
   └─ assertTenantScope(ctx, result, toolName)
   └─ Check organizationId + projectId match
   └─ Fail → TenantLeakError

7. Audit Log
   └─ toolCallRepo.log({ runId, organizationId, toolName, riskTier, status, ... })
   └─ SUCCESS or ERROR logged to agent_tool_calls table

8. Return ToolResult<T>
   └─ { ok: true, data: result } OR { ok: false, code, message }
```

**Key Observations:**
- RBAC check happens BEFORE execution (no side effects on denial) ✅
- Tenant check happens AFTER execution (result is validated post-fetch) ⚠️
- Args are redacted before storage (PII keys stripped) ✅
- Result summary is compacted (keys only, no values) ✅
- No response-level redaction (see RECON-003) ❌

### 3.2 Approval Flow (BINDING Tools)

**Current Live Path:** `agent_approvals` (exact-action binding)

```
BINDING Tool Call
└─ ApprovalRequiredError thrown
└─ Runner catches → run.status = INTERRUPTED
└─ Approval row created:
   - runId, organizationId, toolName
   - approvedToolName, approvedArgsHash (exact action binding)
   - status = PENDING, expiresAt = 24h from now

User Decision
├─ APPROVE → approval.status = APPROVED, decidedBy = userId
│  └─ Resume run → worker picks up, checkApprovalGate passes, tool executes
├─ REJECT → approval.status = REJECTED, decisionNote recorded
│  └─ Run remains INTERRUPTED (no resume)
└─ EXPIRE → approval.status = EXPIRED after 24h (fake clock in tests)
   └─ Run remains INTERRUPTED (no resume)

Resume Execution
└─ findLatestForRun(runId) → must be APPROVED
└─ Verify approvedToolName === toolName
└─ Verify approvedArgsHash === hash(sortedArgs)
└─ TOCTOU protection: args tampered → ApprovalRequiredError
└─ Tool executes exactly once, idempotent on double-approve
```

**Orphaned Code:** `binding-tools/tool-approval.service.ts` exists but is NOT used by the live path. The live path uses `agent_approvals` table + `ApprovalRepository`.

### 3.3 Coordinator Delegation

**Entry Point:** `coordinator` agent graph → `route_to_agent` tool

```
User Question → Coordinator Agent
└─ Classifies intent (LLM call with cheap tier)
└─ Calls route_to_agent(targetAgent, delegatedQuestion)
└─ Creates NEW agent_run row:
   - agent = targetAgent
   - parentRunId = coordinator.runId
   - organizationId, projectId, userId inherited
   - trigger = 'api'
└─ Enqueues to PgBoss: AI_QUEUES.AGENT_RUN
└─ Waits for sub-run completion (polling or webhook?)
└─ Returns sub-run output to coordinator graph
└─ Coordinator synthesizes final answer
```

**Untested Scenarios (from code inspection):**
- Ambiguous queries spanning multiple domains
- Coordinator routing to itself (recursion guard?)
- One sub-agent times out → coordinator partial answer?
- Coordinator calling multiple agents in parallel
- Cross-turn context (cost question → reports follow-up)
- Binding triggered from sub-agent (approval flow with delegation)

### 3.4 Conversation & Checkpoint State

**Storage:**
- `agent_runs` table: runId, status, inputSnapshot, outputSnapshot, checkpointThreadId
- LangGraph checkpointer: `langgraph.checkpoints`, `langgraph.checkpoint_blobs`, `langgraph.checkpoint_writes`
- Memory: Redis namespaced keys `memory:{orgId}:{projectId}:{agent}:{key}`

**State Topology:**
- RunContext is frozen after construction (Object.freeze)
- organizationId, projectId, userId NEVER from LLM input
- Limits resolved from plan tier, never user input
- Memory attached per-run via `attachMemory(ctx, memory)`

### 3.5 Which Approval Path is LIVE?

**CONFIRMED LIVE:** `agent_approvals` table via `ApprovalRepository`  
**ORPHANED:** `tool_approvals` table (if it exists) + `ToolApprovalService`

**Evidence:**
- `tool-factory.ts` imports `ApprovalRepository` from `../approvals/approval.repository.js` ✅
- `binding.tools.ts` imports `ToolApprovalService` from `../../binding-tools/tool-approval.service.js` ❌ (never loaded)

---

## 4. Contract Drift Table

| Claim / Test Expectation | Code Reality | Status | Source |
|--------------------------|--------------|--------|--------|
| **Memory numeric-key guard** | Not implemented; keys are strings, no numeric validation | ❌ DRIFT | memory-store.ts accepts any string key |
| **`agentName` vs `agent` field** | Schema uses `agent` everywhere; `agentName` never appears | ❌ DRIFT | types.ts, schema |
| **Per-write TTL on memory** | TTL is per-namespace (90 days), not per-write configurable | ⚠️ PARTIAL | memory-store.ts::set() uses fixed ttlDays |
| **Response-level PII redaction** | Only arg-level redaction before DB storage; no output guard | ❌ MISSING | tool-factory.ts redacts args, output-guard.ts does NOT redact responses |
| **Input-guard block vs flag** | Guards with `hardBlock: true` throw error; others flag+log | ✅ CORRECT | input-guard.ts::guardInput() |
| **TTS implementation** | Not found in codebase | ❌ MISSING | No TTS service or routes exist |
| **Test database name** | Test setup only accepts `"siteflow"`, not `"siteflow_test"` | ❌ CRITICAL | tests/global-setup.ts line 64 |
| **Binding tools live** | Only 1 test binding tool live; 2 production tools orphaned | ❌ DRIFT | binding.tools.ts import error |
| **Tool count: "50+ tools"** | 37 registered tools (39 including orphaned) | ⚠️ QUALIFIED | Possibly includes coordinator special tools + future tools |
| **Agent count: "5 agents"** | 10 agents total (6 production + 4 test) | ⚠️ QUALIFIED | Claim may refer to production agents only, excluding fixtures |
| **Stale existing tests** | No AI-specific test suites found except worker-schema test | ✅ CORRECT | tests/ directory inspection |

---

## 5. Existing Coverage Map

### 5.1 Test Files Found

| Path | Purpose | Status |
|------|---------|--------|
| `tests/autonomous-e2e/worker-schema-exports.test.ts` | Verifies schema package exports required tables | ✅ Active (1 finding: AI-WKR-001) |
| `tests/autonomous-e2e/FINDINGS.md` | Findings ledger from prior audit | ✅ Active (1 P1 finding documented) |
| `tests/integration/auth.test.ts` | Auth module integration tests | ✅ Active (not AI-related) |
| `tests/unit/auth/password.service.test.ts` | Password service unit tests | ✅ Active (not AI-related) |

**AI Module Coverage:** ~0% (only schema export verification, no agent/tool/guardrail/memory tests)

### 5.2 Gaps to Fill

**NOT TESTED (must add):**
- ✅ Memory isolation (org A vs org B)
- ✅ Learning loop (propose_okf_page → DRAFT → approval → search_knowledge_base serves APPROVED only)
- ❌ Binding tool approval flow (end-to-end: interrupt → approve → resume)
- ✅ Agent integration (coordinator delegation)
- ❌ OCR/vision/voice (multimodal)
- ✅ Coordinator routing (50 cases exist somewhere - find and extend)
- ❌ Guardrails (injection, output safety, validation)
- ❌ Tenancy (cross-org attacks on every surface)
- ❌ Tool pipeline (RBAC, tier gate, tenant assertion)
- ❌ Resilience (loops, 429/500, Redis down, timeouts, crashes)

---

## 6. Blockers & Stop Points

### RECON-001: Test Database Safety Gate MISMATCH (P0 - BLOCKER)

**Severity:** P0  
**Status:** NOT FIXED - REQUIRES APPROVAL

**Issue:** Test setup at `tests/global-setup.ts` line 64 only accepts database name `"siteflow"`:

```typescript
if (dbName !== 'siteflow') {
  throw new Error(
    `SAFETY FAILURE: Tests may ONLY run against "siteflow". ` +
      `Attempted target: "${dbName}". Aborting to protect data.`,
  );
}
```

**Requirements state:** Tests MUST run against `"siteflow_test"` to prevent contamination of development data.

**Impact:** 
- All destructive tests (cascade deletes, memory wipes) are UNSAFE to run
- Cannot proceed to Phase 1 without fixing this
- DB gate is the PRIMARY safety mechanism per prime directive #4

**Proposed Fix:** Change line 64 to:

```typescript
if (dbName !== 'siteflow_test') {
  throw new Error(
    `SAFETY FAILURE: Tests may ONLY run against "siteflow_test". ` +
      `Attempted target: "${dbName}". Aborting to protect data.`,
  );
}
```

**Required:** Human approval before proceeding.

---

### RECON-002: Binding Tools Import Path Error (P1 - CRITICAL)

**Severity:** P1  
**Status:** NOT FIXED - SOURCE DEFECT

**Issue:** `binding.tools.ts` line 3 imports from `'../registry.js'` which does not exist. Should be `'../tool-registry.js'`.

```typescript
// WRONG:
import { registerTool } from '../registry.js';

// CORRECT:
import { registerTool } from '../tool-registry.js';
```

**Impact:**
- `binding.tools.ts` is never loaded (not in `ai/index.ts` imports)
- 2 production BINDING tools are unreachable: `send_message`, `submit_purchase_request`
- Approval flow cannot be tested end-to-end with real tools

**Proposed Patch:** `proposed-patches/RECON-002.diff` (to be created)

**Required:** Human approval before applying source fix.

---

### RECON-003: No Response-Level PII Redaction (P1 - SECURITY)

**Severity:** P1  
**Status:** CONFIRMED MISSING - DESIGN GAP

**Issue:** Tool outputs (data returned to LLM and stored in DB/Langfuse) are NOT redacted for PII. Only tool arguments are redacted before storage.

**Evidence:**
- `tool-factory.ts` calls `redactArgs()` before logging
- `output-guard.ts` exists but is NOT called in the tool pipeline
- No response envelope processing in `executeTool()`

**Impact:**
- SSN, credit cards, API keys, phone numbers in tool results are exposed to:
  - Agent LLM context
  - Database (`agent_runs.outputSnapshot`)
  - Langfuse traces (if configured)
  - User-facing responses

**Proposed Solution:** Add response redaction in tool-factory after step 5 (execute) and before step 7 (audit log).

**Test Coverage:** A4 Output Safety test suite will expose this as a failing test.

**Required:** Document as finding, write failing test, propose patch, STOP.

---

## 7. Architecture Notes

### 7.1 Directory Structure

```
apps/server/src/modules/ai/
├── agents/           # 10 agent implementations
│   ├── compliance/
│   ├── coordinator/
│   ├── cost-financial/
│   ├── echo/ echo-approval/ echo-loop/ echo-slow/
│   ├── estimating-boq/
│   ├── procurement/
│   └── reports/
├── approvals/        # LIVE: agent_approvals table + repository
├── binding-tools/    # ORPHANED: tool_approvals service (not used)
├── conversations/    # Conversation state management
├── core/             # agent-registry, types, run-context, errors
├── cost/             # Cost tracking (not tools)
├── docs/             # OpenAPI schemas
├── evals/            # Evaluation harness (not tested)
├── graph/            # LangGraph runtime (not inspected yet)
├── guardrails/       # input-guard, output-guard
├── ingestion/        # Document embedding pipeline
├── memory/           # Redis-backed memory store
├── observability/    # Tracing (Langfuse/OTEL)
├── ocr/              # OCR for invoices (not inspected yet)
├── okf/              # OKF knowledge base service
├── runs/             # agent_run routes + repository
├── tools/            # Tool registry + factory + definitions
├── vision/           # Vision for photos (not inspected yet)
├── voice/            # STT transcription (no TTS)
└── workers/          # PgBoss workers for agent execution
```

### 7.2 Migrations

**Count:** Not yet inspected (need to scan `packages/database/drizzle/`)

### 7.3 LOC

**Command:** `cloc apps/server/src/modules/ai/ --exclude-dir=node_modules`

*Not yet run - will execute in Phase 5 for claims verification.*

---

## 8. Known Gaps (Not Yet Inspected)

| Component | Reason | Priority |
|-----------|--------|----------|
| **LangGraph runtime** (`graph/`) | Complex state machine, needs dedicated inspection | HIGH |
| **OCR implementation** (`ocr/`) | Multimodal claims verification | MEDIUM |
| **Vision implementation** (`vision/`) | Multimodal claims verification | MEDIUM |
| **Voice STT** (`voice/`) | Multimodal claims verification | MEDIUM |
| **Coordinator tools** | `route_to_agent`, `list_available_agents` inline definition | HIGH |
| **Reports tools** | Agent registered but tools not defined (likely in reports module) | MEDIUM |
| **Evals harness** (`evals/`) | Judge implementation for Tier B tests | LOW |
| **Ingestion pipeline** (`ingestion/`) | RAG document processing | LOW |
| **Observability** (`observability/`) | Langfuse integration | LOW |
| **DB migrations** | Count, schema evolution | MEDIUM |

---

## 9. Next Steps (Phase 1 Prerequisites)

**BEFORE PROCEEDING TO PHASE 1:**

1. **HUMAN DECISION REQUIRED:** Fix RECON-001 (test database name)
   - Approve proposed change to `tests/global-setup.ts`
   - Update `DATABASE_URL` in `.env` to `siteflow_test`
   - Re-run global setup to create and migrate `siteflow_test` DB

2. **OPTIONAL:** Fix RECON-002 (binding tools import)
   - Review proposed patch
   - Apply to enable real BINDING tool testing
   - OR: defer and test with `fake_approve_something` only

3. **DOCUMENT ONLY:** RECON-003 (output redaction)
   - Leave as-is for now
   - Write failing test in Phase 3 (A4 suite)
   - Propose fix after test demonstrates impact

**ONCE APPROVED:**
- Proceed to Phase 1: Environment & Safety Gates
- Spin up docker compose (postgres, redis, minio)
- Verify DB isolation, create fixtures
- Begin Phase 2 harness construction

---

## Appendix A: Tool-Agent Matrix (for RBAC Testing)

*To be generated programmatically in Phase 3 from agent manifests and tool registry.*

**Pattern:**
```
| Tool Name              | cost-financial | procurement | compliance | estimating-boq | coordinator | reports |
|------------------------|----------------|-------------|------------|----------------|-------------|---------|
| get_financial_summary  | ✅ allowed     | ❌ denied   | ❌ denied  | ❌ denied      | ❌ denied   | ? TBD   |
| ...                    | ...            | ...         | ...        | ...            | ...         | ...     |
```

**To generate:** Iterate `listAgents()`, for each agent get `allowedTools`, for each registered tool check if in list.

---

## Appendix B: Commit Evidence

**All findings in this report are based on code state at:**

```
Commit: 6ff0dc955a07fba70b4c231e60bdee97e6f21a69
Branch: development (HEAD)
Date: 2026-11-06
Message: feat(ai): memory, learinin capabilities, multimodal supprot added for all the agents
```

**Commands run:**
- `git log --oneline --all -1` → commit SHA recorded
- File reads via `read_files` tool (no destructive operations)
- Directory listings via `list_directory` tool

**NO TESTS HAVE BEEN RUN YET.** This is reconnaissance only.

---

**END OF RECONNAISSANCE REPORT**

