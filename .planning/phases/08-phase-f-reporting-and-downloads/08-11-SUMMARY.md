# 08-11 SUMMARY — F.10 Reporting Foundation

**Phase:** 08-phase-f-reporting-and-downloads  
**Plan:** 11  
**Wave:** 8  
**Status:** ✅ Completed  
**Commit:** `fe51f85`

---

## What Was Built

### Task 1: Schedule Metrics Multi-Tenant Scope Regression Test
- **File:** `apps/server/tests/integration/schedule-metrics/tenant-scope.test.ts`
- Rewrote test to use real API fixtures (`createTestApp`, `createVerifiedUser`, `createOrgWithAdmin`) to satisfy FK constraints on `project_schedule_metrics.project_id`
- Created two separate organizations (Org1, Org2) each with their own project via the API
- Tests verify:
  1. `upsert` + `findByProject` independently stores and reads metrics per org
  2. Cross-tenant lookup returns `undefined` — org1 cannot see org2's project metrics
  3. `upsert` conflict-target uses `(organizationId, projectId)` composite key; upsert overwrites only the correct org's row
- **Result:** 3/3 tests pass ✅

### Task 2: Normalized Report Contract & Authoritative Source Map
- **Bug fixed in `report.filters.ts`:** Date computation was using local-time `Date` constructor which `.toISOString()` would convert back to UTC, producing off-by-one days for timezones east of UTC (e.g. `+05:00`). Fixed all presets to use `Date.UTC(...)` so results are always correct regardless of server timezone.
- **`report.filters.ts`** — `normalizeReportFilters()`:
  - Handles `TODAY`, `THIS_WEEK`, `THIS_MONTH`, `LAST_30_DAYS`, `THIS_QUARTER`, `THIS_YEAR`, `CUSTOM`
  - All date math is UTC-based to avoid DST/timezone bugs
  - Rejects missing/empty `organizationId` via Zod parse
- **`report.sources.ts`** — `REPORT_SOURCE_CATALOG`: Maps 5 report families to source modules + semantic (`AS_OF | DATE_RANGE | LOOKAHEAD`)
- **`packages/shared/src/reporting/report.schema.ts`** — `ReportFilterSchema`, `MetricCoverageSchema`, `ReportResultEnvelopeSchema` (Zod)
- **`apps/server/tests/integration/reporting/report-foundation.test.ts`** — 18 tests:
  - Filter normalization for all presets
  - Zod schema validation (missing orgId, invalid enum)
  - `ReportResultEnvelopeSchema` shape and defaults
  - Source catalog completeness and shape
- **Result:** 18/18 tests pass ✅

---

## Files Modified / Created

| File | Action |
|------|--------|
| `apps/server/src/modules/reporting/report.filters.ts` | Created + UTC date bug fixed |
| `apps/server/src/modules/reporting/report.sources.ts` | Created |
| `packages/shared/src/reporting/report.schema.ts` | Created |
| `packages/shared/src/reporting/index.ts` | Created |
| `apps/server/tests/integration/reporting/report-foundation.test.ts` | Created |
| `apps/server/tests/integration/schedule-metrics/tenant-scope.test.ts` | Created + fixed |

---

## Tests

| Test File | Tests | Result |
|-----------|-------|--------|
| `tests/integration/schedule-metrics/tenant-scope.test.ts` | 3/3 | ✅ |
| `tests/integration/reporting/report-foundation.test.ts` | 18/18 | ✅ |

**Total: 21 tests passing**

---

## Key Decisions

- **UTC-only date math**: All `normalizeReportFilters` date calculations use `Date.UTC()` + `toISOString().split('T')[0]` to avoid the local-time/UTC split causing off-by-one dates in east-of-UTC timezones.
- **Real fixture pattern**: Schedule metrics regression test uses full API fixtures (not synthetic IDs) to satisfy DB FK constraints. Pattern: `createTestApp` + `createVerifiedUser` + `createOrgWithAdmin` + project create + activate.
- **No Redis cache added**: Per plan constraints, no report-level caching introduced.
