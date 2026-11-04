---
type: Table
title: Quality Deficiencies
description: Non-conformances found during quality inspections. Tracked from open to closed with corrective actions.
tags: [quality, deficiency, inspection]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
---

# Schema

| Column               | Type   | Description                                            |
|----------------------|--------|--------------------------------------------------------|
| `id`                 | string | UUID primary key                                       |
| `deficiencyNumber`   | string | Auto-allocated human-readable number (DEF-YYYYMM-NNN) |
| `inspectionId`       | string | Optional FK → quality_inspections.id                  |
| `title`              | string | Short description of the non-conformance               |
| `description`        | string | Detailed description                                   |
| `severity`           | enum   | LOW, MEDIUM, HIGH, CRITICAL                            |
| `status`             | enum   | OPEN, IN_PROGRESS, RESOLVED, CLOSED, DISPUTED, CANCELLED |
| `responsibleMemberId`| string | Project member responsible for resolution              |
| `dueDate`            | date   | Target resolution date                                 |
| `closedAt`           | timestamp | When the deficiency was closed                      |

# Status Lifecycle

    OPEN → IN_PROGRESS → RESOLVED → CLOSED
    OPEN → DISPUTED
    OPEN → CANCELLED
    IN_PROGRESS → DISPUTED

- **OPEN**: Deficiency recorded, not yet being worked.
- **IN_PROGRESS**: Resolution work underway.
- **RESOLVED**: Corrective action complete, awaiting verification.
- **CLOSED**: Verified and formally closed (requires verifyCorrectiveAction).
- **DISPUTED**: Responsibility or scope disputed; requires human resolution.
- **CANCELLED**: Determined to be invalid or duplicate.

# Severity Guide

- **LOW**: Minor cosmetic or administrative issue.
- **MEDIUM**: Functional issue with workaround available.
- **HIGH**: Significant non-conformance requiring prompt action.
- **CRITICAL**: Structural, safety, or regulatory non-conformance requiring immediate action.

# Agent Restrictions

Agents CAN: list deficiencies, report counts and trends by severity/status, identify overdue items.
Agents CANNOT: close, resolve, or cancel deficiencies. These require authorized human action.
