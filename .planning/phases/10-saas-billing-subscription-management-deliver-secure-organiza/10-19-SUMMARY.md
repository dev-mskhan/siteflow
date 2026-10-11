# 10-19 Summary: Restricted-Access Enforcement

## Result
Restricted-state enforcement covers the D-09 matrix, except `api:access`, which is an open gap.

| Operation | Status | Where |
|---|---|---|
| project:create | Enforced (existing) | entitlement.service.ts `assertCanCreateProject` |
| project:update | Enforced (commit f172adc) | entitlement.service.ts `assertCanModifyProject`, called from project.service.ts `updateProject` |
| member:invite | Enforced (existing) | entitlement.service.ts `assertCanUseMemberSeat`, used by invitation create and accept |
| api:access | GAP, out of scope | No API-key surface exists in the codebase |

## Decisions
- Restricted check runs before the null-limits check, so RESTRICTED returns `ACCESS_RESTRICTED`, not `NO_ENTITLEMENT`.
- `addProjectMember` is not a matrix operation, so it has no restricted guard.
- Reads (GET project) stay allowed in RESTRICTED.

## Tests
- `tests/integration/billing/restricted-access.test.ts`: ACTIVE allows PATCH; RESTRICTED returns 403 `ACCESS_RESTRICTED`; GET still returns 200. Passing.
- Regression: `lifecycle` suite passes. `project_core` shows 24 failing tests on the clean baseline too, so they predate this work.

## Open items
- `api:access`: needs a plan amendment or a later API-key phase before it can be enforced.
- The 24 `project_core` failures and `export-lifecycle` failure are pre-existing and not caused by 10-19.
