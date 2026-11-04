---
type: Table
title: BOQ Items
description: Bill of Quantities line items. Each item has a description, unit, quantity, and optional cost code mapping.
tags: [boq, estimating, cost-codes]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
---

# Schema

| Column        | Type    | Description                                              |
|---------------|---------|----------------------------------------------------------|
| `id`          | string  | UUID primary key                                         |
| `revisionId`  | string  | FK → boq_revisions.id                                   |
| `sectionId`   | string  | FK → boq_sections.id                                    |
| `itemKey`     | string  | Stable key (e.g. "A.1.3"), unique per revision          |
| `description` | string  | Work item description (1–500 chars)                      |
| `specification`| string | Optional technical specification                         |
| `unit`        | string  | Unit of measure (e.g. m2, m3, EA, KG, HR)               |
| `quantity`    | numeric | Quantity of work (precision 15,3)                        |
| `unitRate`    | numeric | Rate per unit (optional — may be blank on import)        |
| `amount`      | numeric | `quantity × unitRate` (precision 15,2)                   |
| `currencyCode`| string  | ISO 4217 currency code (e.g. USD)                        |
| `costCodeId`  | string  | FK → project_cost_codes.id (optional mapping)            |
| `provenance`  | jsonb   | Source of item (e.g. CSV import run ID and row number)   |

# BOQ Lifecycle

BOQ status: DRAFT → IN_REVIEW → APPROVED → LOCKED
Revision status: DRAFT → IN_REVIEW → APPROVED → LOCKED → SUPERSEDED

Items belong to a revision. When a BOQ is revised, a new revision is created and the old one is marked SUPERSEDED. Items are deep-copied between revisions.

# Common Units

- Area: m2
- Volume: m3
- Length: m, mm
- Count: EA (each), NO (number)
- Mass: KG, T (tonne)
- Time: HR (hour), DAY

# Agent Restrictions

Agents CAN: read BOQ sections and items, list revisions, compare estimate vs BOQ amounts.
Agents CANNOT: create, approve, or lock BOQs. These are human financial-control actions.

See [project-cost-codes](/tables/project-cost-codes.md) for cost code structure.
