---
type: Table
title: Project Cost Codes
description: Free-text cost codes scoped per project used to categorize BOQ items, estimate lines, and takeoff measurements.
tags: [finance, cost-codes, boq, estimate]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
---

# Schema

| Column          | Type    | Description                                          |
|-----------------|---------|------------------------------------------------------|
| `id`            | string  | UUID primary key                                     |
| `projectId`     | string  | FK → projects.id                                    |
| `organizationId`| string  | FK → organizations.id                               |
| `code`          | string  | Free-text code, unique per project (e.g. "03.21.10") |
| `description`   | string  | Optional human-readable label                        |
| `isActive`      | boolean | Soft-deactivation flag (default true)               |

# Rules

- Cost codes are **free-text per project** — there is no global enum or standard hierarchy.
- Each project defines its own codes during setup.
- The code is unique per `(projectId, code)` pair.
- Inactive codes (`isActive = false`) still exist on historical records but cannot be used for new assignments.
- BOQ items, estimate lines, and takeoff measurements all reference cost codes via `costCodeId`.

# Examples

    03.21.10 — Concrete Reinforcement (Rebar)
    05.12.00 — Structural Steel
    01.01.00 — General Requirements
