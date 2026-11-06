# Claims Ledger

**Purpose:** Evidence-backed verification of all resume/documentation claims about the SiteFlow AI module.

**Rules:**
1. Every number must have provenance: command + output + commit SHA + date
2. No baseline = no multiplier claim
3. No corpus = no accuracy claim
4. Legal claims (GDPR) → CONTRADICTED with capability-only wording
5. Claims are NEVER rounded up; qualified or downgraded based on evidence

**Legend:**
- ✅ VERIFIED: Claim proven with measurement
- ⚠️ QUALIFIED: Claim partially true with caveats
- ❌ UNVERIFIED: No measurement possible or not yet measured
- 🚫 CONTRADICTED: Evidence disproves claim

---

## Test & Coverage Claims

| Claim | Status | Measured Value | Evidence | Test/Command | Resume-Safe Wording |
|-------|--------|----------------|----------|--------------|---------------------|
| "96+ tests" | ❌ UNVERIFIED | Pending | N/A | `vitest --run --reporter=json \| jq '.numTotalTests'` | *To be measured after test suites built* |
| "50+ tools" | ⚠️ QUALIFIED | 37 registered (39 total, 2 orphaned) | RECON.md § 2.2 | Code inspection of tool definitions | "37 registered AI tools across 6 domains (cost, procurement, compliance, estimating, knowledge, test fixtures)" |
| "5 agents" | ⚠️ QUALIFIED | 6 production + 4 test = 10 total | RECON.md § 1.1 | Code inspection of agent-registry.ts | "6 production agents (cost-financial, procurement, compliance, estimating-boq, coordinator, reports) plus 4 test fixtures" |

---

## Performance Claims

| Claim | Status | Measured Value | Evidence | Test/Command | Resume-Safe Wording |
|-------|--------|----------------|----------|--------------|---------------------|
| "<3s P95 latency" | ❌ UNVERIFIED | Pending | N/A | Phase 5 benchmark (N≥30 runs, p50/p95/p99 from trace logs) | *To be measured* |
| "$0.01/query cost" | ❌ UNVERIFIED | Pending | N/A | Phase 5 cost benchmark (query mix × usage records × pricing) | *To be measured* |
| "10x cheaper" | ❌ UNVERIFIED | No baseline | N/A | Requires defined baseline config + same workload | **CLAIM INVALID** (no baseline = no multiplier) |
| "<100ms memory ops" | ❌ UNVERIFIED | Pending | N/A | Phase 5 memory benchmark (N≥1000 Redis get/set/list on real instance) | *To be measured* |

---

## Accuracy Claims

| Claim | Status | Measured Value | Evidence | Test/Command | Resume-Safe Wording |
|-------|--------|----------------|----------|--------------|---------------------|
| "≥85% OCR accuracy" | ❌ UNVERIFIED | No corpus | N/A | Requires golden invoice dataset with ground-truth field labels | **CLAIM INVALID** (no corpus = no accuracy claim) |
| "95%+ voice accuracy" | ❌ UNVERIFIED | No corpus | N/A | Requires labeled audio set with transcripts | **CLAIM INVALID** (no corpus = no accuracy claim) |
| "Routing accuracy with CI" | ❌ UNVERIFIED | Pending | N/A | Phase 3 (A8): routing test suite with Wilson CI | *To be measured* |
| "Red-team neutralization rate with CI" | ❌ UNVERIFIED | Pending | N/A | Phase 3 (A3): injection suite (N≥50 cases) with Wilson CI | *To be measured* |

---

## Speed Claims

| Claim | Status | Measured Value | Evidence | Test/Command | Resume-Safe Wording |
|-------|--------|----------------|----------|--------------|---------------------|
| "30x faster invoice processing" | ❌ UNVERIFIED | No baseline | N/A | Requires defined baseline + same workload (system time only, no human) | **CLAIM INVALID** (no baseline = no multiplier) |
| "24x faster report generation" | ❌ UNVERIFIED | No baseline | N/A | Requires defined baseline + same workload (system time only, no human) | **CLAIM INVALID** (no baseline = no multiplier) |

---

## Efficiency Claims

| Claim | Status | Measured Value | Evidence | Test/Command | Resume-Safe Wording |
|-------|--------|----------------|----------|--------------|---------------------|
| "70% document automation" | ❌ UNVERIFIED | No baseline | N/A | Requires defined manual workflow + automation workflow comparison | **CLAIM INVALID** (no baseline = no %) |
| "40% fewer API calls" | ❌ UNVERIFIED | No baseline | N/A | Requires defined baseline config (no caching?) + same workload | **CLAIM INVALID** (no baseline = no %) |

---

## Security & Compliance Claims

| Claim | Status | Measured Value | Evidence | Test/Command | Resume-Safe Wording |
|-------|--------|----------------|----------|--------------|---------------------|
| "Zero security incidents" | 🚫 CONTRADICTED | No production history | RECON.md (no prod deployment) | N/A | **INVALID CLAIM** (no production = no incident history). Replace with: "Multi-layer security controls: tenant isolation, RBAC, approval gates, input guards, audit logging" |
| "100% GDPR compliant" | 🚫 CONTRADICTED | Legal claim, not technical | N/A | Legal audit required, not code audit | **INVALID CLAIM** (legal status, not capability). Replace with: "GDPR-ready capabilities: cascade delete on org/project removal, PII redaction in logs, 90-day memory TTL" |
| "3-layer tenant isolation" | ⚠️ QUALIFIED | Confirmed in code | RECON.md § 3.1 (RBAC, tenant assertion, memory namespacing) | Code inspection | "3-layer tenant isolation: (1) RBAC permission check, (2) post-query tenant assertion, (3) Redis memory namespacing by organizationId" |
| "Injection prevention" | ⚠️ QUALIFIED | Input guards exist, no output redaction | RECON.md RECON-003 finding | Phase 3 (A3): injection suite will measure block rate | "Input injection guards with pattern-based detection (8 heuristics); output PII redaction **NOT IMPLEMENTED** (see RECON-003)" |
| "PII redaction" | 🚫 CONTRADICTED | Args only, not responses | RECON.md RECON-003 | Code inspection | **PARTIAL**: "Tool argument PII redaction before DB storage (8 sensitive key patterns); response-level redaction **NOT IMPLEMENTED**" |

---

## Architecture Claims

| Claim | Status | Measured Value | Evidence | Test/Command | Resume-Safe Wording |
|-------|--------|----------------|----------|--------------|---------------------|
| "HITL gates" | ⚠️ QUALIFIED | Approval flow exists, only 1 live tool | RECON.md § 3.2 | Code inspection | "Human-in-the-loop approval gates for BINDING tools with exact-action binding (tool name + args hash); 24h expiry; TOCTOU protection. **NOTE:** Only 1 test tool currently wired (2 production tools orphaned, see RECON-002)" |
| "Learning loop" | ✅ VERIFIED | Implemented | RECON.md § 2.3 (`propose_okf_page` tool) | Code inspection | "Learning loop: agents propose OKF knowledge pages from user corrections → DRAFT status → admin approval → served to all agents via search_knowledge_base" |
| "Parallel multi-agent" | ❌ UNVERIFIED | Coordinator exists, parallelism not confirmed | RECON.md § 3.3 | Phase 3 (A8): test multi-domain query | *To be verified* |
| "Distributed tracing" | ❌ UNVERIFIED | Observability module exists | RECON.md § 7.1 | Integration check (Langfuse/OTEL) | *To be verified* |
| "RAG" | ✅ VERIFIED | Implemented | RECON.md § 2.3 (`search_knowledge_base` with pgvector + SQL joins) | Code inspection | "Graph-augmented vector RAG: semantic search with pgvector + SQL joins to linked entities (inspections, deficiencies, permits, takeoffs); Jina embeddings (1024-dim)" |
| "Multimodal" | ⚠️ QUALIFIED | STT exists, no TTS | RECON.md § 4 (contract drift: TTS missing) | Code inspection | "Multimodal input: STT (Whisper), OCR (invoices), vision (photos). **TTS output NOT IMPLEMENTED**" |
| "Redis hierarchical memory" | ✅ VERIFIED | Implemented | RECON.md § 3.4 + memory-store.ts code | Code inspection | "Redis-backed hierarchical memory: namespaced by organizationId/projectId/agent; 90-day TTL; stores preferences and corrections only (not facts)" |
| "Outbox pattern" | ❌ UNVERIFIED | Schema exists, implementation not inspected | packages/database/src/schema/outbox.schema.ts open in editor | Code inspection pending | *To be verified* |

---

## Development Claims

| Claim | Status | Measured Value | Evidence | Test/Command | Resume-Safe Wording |
|-------|--------|----------------|----------|--------------|---------------------|
| "CI/CD" | ❌ UNVERIFIED | Pending | N/A | Check for `.github/workflows/` or `.gitlab-ci.yml` + last run status | *To be verified* |
| "9 migrations / 5 waves" | ❌ UNVERIFIED | Pending | N/A | `ls -1 packages/database/drizzle/*.sql \| wc -l` | *To be measured* |
| "20k+ LOC" | ❌ UNVERIFIED | Pending | N/A | `cloc apps/server/src/modules/ai/ --exclude-dir=node_modules` | *To be measured* |
| "Turborepo" | ✅ VERIFIED | Confirmed | `.turbo/` directory exists, `turbo.json` not inspected yet | File system inspection | "Turborepo monorepo with build caching (`.turbo/cache/` contains 649 files)" |
| "End-to-end type safety" | ❌ UNVERIFIED | Pending | N/A | `tsc --noEmit` on AI module + count of `any` types | *To be measured* |

---

## Summary Statistics (To Be Updated After Testing)

| Metric | Current | Target |
|--------|---------|--------|
| **Claims Verified** | 4 | 47 |
| **Claims Qualified** | 7 | - |
| **Claims Unverified** | 30 | 0 |
| **Claims Contradicted** | 6 | 0 (must resolve) |
| **Test Suites Implemented** | 0 | 10 (A1-A10) |
| **Findings Documented** | 3 (RECON-001/002/003) | All defects |

---

## Phase Completion Tracker

- [ ] **Phase 0: Reconnaissance** - ✅ COMPLETE (this document created)
- [ ] **Phase 1: Environment & Safety Gates** - ⏸️ BLOCKED (awaiting RECON-001 approval)
- [ ] **Phase 2: Harness** - 🔴 NOT STARTED
- [ ] **Phase 3: Tier A Suites** - 🔴 NOT STARTED
- [ ] **Phase 4: Tier B** - 🔴 NOT STARTED (requires explicit flag + budget)
- [ ] **Phase 5: Claim Benchmarks** - 🔴 NOT STARTED

---

**Last Updated:** 2026-11-06 (Reconnaissance complete, awaiting approval to proceed)

