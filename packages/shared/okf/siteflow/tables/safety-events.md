---
type: Table
title: Safety Events
description: Safety incidents, near misses, unsafe conditions, and acts reported on a project.
tags: [safety, incident, near-miss]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
---

# Schema

| Column            | Type      | Description                                                    |
|-------------------|-----------|----------------------------------------------------------------|
| `id`              | string    | UUID primary key                                               |
| `eventNumber`     | string    | Auto-allocated (SAF-YYYYMM-NNN)                               |
| `eventType`       | enum      | INCIDENT, NEAR_MISS, UNSAFE_CONDITION, UNSAFE_ACT, FIRST_AID  |
| `title`           | string    | Brief description                                              |
| `description`     | string    | Full account of the event                                      |
| `status`          | enum      | REPORTED, UNDER_INVESTIGATION, CORRECTIVE_ACTION_REQUIRED, CORRECTIVE_ACTION_IN_PROGRESS, CLOSED |
| `severity`        | enum      | LOW, MEDIUM, HIGH, CRITICAL, FATALITY                          |
| `occurredAt`      | timestamp | When the event occurred                                        |
| `location`        | string    | Site location                                                  |
| `rootCause`       | string    | Set during investigation phase                                 |
| `closedAt`        | timestamp | When the event was formally closed                            |

# Status Lifecycle

    REPORTED → UNDER_INVESTIGATION → CORRECTIVE_ACTION_REQUIRED → CORRECTIVE_ACTION_IN_PROGRESS → CLOSED

- Transition from UNDER_INVESTIGATION → CORRECTIVE_ACTION_REQUIRED requires rootCause to be set.
- Events auto-close when all linked corrective actions are VERIFIED.
- HIGH, CRITICAL, and FATALITY events trigger outbox notifications.

# Event Types

- **INCIDENT**: A safety event that caused injury or property damage.
- **NEAR_MISS**: A close call with no injury or damage.
- **UNSAFE_CONDITION**: A hazard that has not yet caused an event.
- **UNSAFE_ACT**: A behavior that creates safety risk.
- **FIRST_AID**: Minor treatment administered on site.

# Agent Restrictions

Agents CAN: list events, report by severity/status/type, identify open events requiring action.
Agents CANNOT: close events, mark as investigated, or create corrective actions. These require authorized personnel.
