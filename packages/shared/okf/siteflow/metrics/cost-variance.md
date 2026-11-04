---
type: Metric
title: Cost Variance
description: Difference between the estimate (budget) and actual posted cost for a given cost code or scope.
tags: [finance, cost, variance]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:cfo, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
---

# Definition

Cost variance compares what was budgeted for a scope of work against what was actually spent.

    cost_variance = budget_amount - actual_cost

A **positive** value means the work came in under budget.
A **negative** value means the work exceeded the budget.

# Usage

Cost variance is typically measured at the cost-code level. Use `compare` on estimate revisions to see variance between estimate revisions and posted actuals.

Categories tracked per estimate line: MATERIAL, LABOR, EQUIPMENT, SUBCONTRACTOR, OTHER.
