---
type: Attested Computation
title: Retainage Calculation
description: Sanctioned formula for retainage held and released per contract terms.
status: stable
runtime: postgres
parameters:
  - name: project_id
    type: string
    required: true
  - name: organization_id
    type: string
    required: true
  - name: payment_application_id
    type: string
    required: false
executor:
  resource: postgres-query
  receipt: [query_id, executed_sql, result, row_count]
attester:
  resource: references/attesters/retainage-check
  description: Verifies computation matches contract retainage terms
generated:
  by: human:team-lead
  at: 2026-11-05T00:00:00Z
verified:
  by: human:cfo
  at: 2026-11-05T00:00:00Z
stale_after: 2027-11-05T00:00:00Z
sources:
  - id: retainage-policy
    resource: https://wiki.siteflow/finance/retainage-policy
    title: Retainage calculation and release policy
    author: team:finance
    last_modified: 2026-10-01T00:00:00Z
tags: [finance, retainage, computation, payment]
---

# Retainage Calculation

Sanctioned computation for calculating retainage held and released per contract terms.

## Formula

```
retainage_held = work_value × retainage_rate
retainage_released = MIN(released_this_period, total_held)
net_retainage = total_held - total_released
```

Where:
- **retainage_rate** = percentage specified in contract (typically 5-10%)
- **work_value** = value of work completed (from payment application)
- **released_this_period** = amount approved for release (when conditions met)

## Attested SQL

```sql
WITH retainage_summary AS (
  SELECT
    pa.project_id,
    pa.id AS payment_application_id,
    pa.work_completed_to_date,
    pc.retainage_rate,
    (pa.work_completed_to_date * pc.retainage_rate / 100.0) AS retainage_held,
    COALESCE(pa.retainage_released_this_period, 0) AS retainage_released,
    COALESCE(
      SUM(prev.retainage_released_this_period) OVER (
        PARTITION BY pa.project_id
        ORDER BY prev.period_end_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS retainage_released_prior
  FROM app.payment_applications pa
  JOIN app.project_contracts pc ON pc.id = pa.contract_id
  LEFT JOIN app.payment_applications prev
    ON prev.project_id = pa.project_id
    AND prev.period_end_date < pa.period_end_date
  WHERE pa.organization_id = @organization_id
    AND pa.project_id = @project_id
    AND (@payment_application_id IS NULL OR pa.id = @payment_application_id)
    AND pa.status = 'APPROVED'
)
SELECT
  project_id,
  payment_application_id,
  work_completed_to_date,
  retainage_rate,
  retainage_held,
  retainage_released,
  retainage_released_prior,
  (retainage_held - retainage_released - retainage_released_prior) AS net_retainage_remaining
FROM retainage_summary
ORDER BY payment_application_id;
```

## Executor Receipt

When executed, the executor MUST return:
- `query_id`: unique identifier for audit trail
- `executed_sql`: the actual SQL run (with parameters substituted)
- `result`: array of retainage calculations per payment application
- `row_count`: number of payment applications

## Attester

The attester verifies:
1. Retainage rate matches contract terms
2. Only APPROVED payment applications used
3. Cumulative release logic correct (prior releases not double-counted)
4. Net remaining cannot be negative
5. Tenant scoping (organization_id) enforced

## Trust

This computation is **human-reviewed** (CFO verified) and attested by automated contract-terms checker.

Agents using this computation can cite it as authoritative source for retainage calculations.

## Release Conditions

Retainage may be released when:
- Substantial completion achieved
- Contract milestones met
- Final completion and acceptance
- Per negotiated payment terms

The computation does NOT decide when to release — it only calculates amounts per approved applications.

## Related Concepts

- [Retainage](../metrics/retainage.md) — metric definition
- [Payment Applications](../tables/payment-applications.md) — payment application schema (if exists)

