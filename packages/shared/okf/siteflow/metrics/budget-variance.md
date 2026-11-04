---
type: Metric
title: Budget Variance
description: Difference between revised budget and committed cost. Positive = under budget; negative = over budget.
tags: [finance, budget, variance]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:cfo, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
sources:
  - id: budget-module
    resource: /tables/project-cost-codes.md
    title: Project cost codes table
---

# Definition

Budget variance measures how the revised budget compares to committed costs.

    variance = revised_budget - committed_cost

A **positive** variance means committed costs are below the revised budget (under budget).
A **negative** variance means committed costs exceed the revised budget (over budget).

# Components

- **Original budget**: The approved baseline budget at project start.
- **Approved changes**: Budget amendments via approved change orders.
- **Revised budget**: `original_budget + approved_changes`
- **Actual cost**: Cost transactions already posted (invoices paid, timesheet entries).
- **Committed cost**: `actual_cost + open_purchase_orders + active_subcontracts`

# Usage

Always use committed cost (not actual cost) as the denominator when assessing exposure. Actual cost understates risk because it excludes open POs and subcontracts that will become actual costs.

See [project cost codes](/tables/project-cost-codes.md) for how costs are categorized.
