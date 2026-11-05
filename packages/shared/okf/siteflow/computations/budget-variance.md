---
type: Attested Computation
title: Budget Variance Calculation
description: Sanctioned computation for budget variance per Finance policy.
status: stable
runtime: postgres
parameters:
  - name: project_id
    type: string
    required: true
  - name: organization_id
    type: string
    required: true
executor:
  resource: postgres-query
  receipt: [query_id, executed_sql, result, row_count]
attester:
  resource: references/attesters/variance-check
  description: Verifies computation matches approved formula
generated:
  by: human:team-lead
  at: 2026-11-05T00:00:00Z
verified:
  by: human:cfo
  at: 2026-11-05T00:00:00Z
stale_after: 2027-11-05T00:00:00Z
sources:
  - id: variance-policy
    resource: https://wiki.siteflow/finance/variance-policy
    title: Variance recognition policy
    author: team:finance
    last_modified: 2026-10-01T00:00:00Z
tags: [finance, budget, variance, computation]
---

# Budget Variance Calculation

Sanctioned computation for calculating budget variance — the difference between revised budget and committed cost.

## Formula

```
variance = revised_budget - committed_cost
```

Where:
- **revised_budget** = original budget + approved changes
- **committed_cost** = actual_cost + open_commitments (POs, subcontracts)

## Attested SQL

```sql
SELECT
  pb.project_id,
  pb.revised_budget,
  pb.committed_cost,
  (pb.revised_budget - pb.committed_cost) AS variance,
  CASE
    WHEN (pb.revised_budget - pb.committed_cost) > 0 THEN 'UNDER_BUDGET'
    WHEN (pb.revised_budget - pb.committed_cost) < 0 THEN 'OVER_BUDGET'
    ELSE 'ON_BUDGET'
  END AS variance_status
FROM app.project_budget_summary pb
WHERE pb.organization_id = @organization_id
  AND pb.project_id = @project_id
  AND pb.status = 'APPROVED';
```

## Executor Receipt

When executed, the executor MUST return:
- `query_id`: unique identifier for audit trail
- `executed_sql`: the actual SQL run (with parameters substituted for verification)
- `result`: the computed variance value
- `row_count`: must be 1 (single project)

## Attester

The attester verifies:
1. Formula matches approved policy (revised - committed)
2. Only APPROVED budget status used
3. Tenant scoping (organization_id) enforced
4. No manual adjustments or overrides applied

## Trust

This computation is **human-reviewed** (CFO verified) and attested by automated policy checker.

Agents using this computation can cite it as authoritative source for variance calculations.

## Related Concepts

- [Budget Variance](../metrics/budget-variance.md) — metric definition
- [Project Cost Codes](../tables/project-cost-codes.md) — cost structure

