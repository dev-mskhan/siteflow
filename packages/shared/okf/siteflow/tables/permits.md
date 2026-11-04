---
type: Table
title: Permits
description: Regulatory and construction permits with a defined approval state machine.
tags: [compliance, permit, regulatory]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
---

# Schema

| Column               | Type   | Description                                      |
|----------------------|--------|--------------------------------------------------|
| `id`                 | string | UUID primary key                                 |
| `permitType`         | string | Free-text type (e.g. "Building Permit")          |
| `referenceNumber`    | string | Authority-issued reference number                |
| `issuingAuthority`   | string | The regulatory body that issued the permit       |
| `status`             | enum   | PENDING, APPLIED, ISSUED, ACTIVE, EXPIRED, REVOKED, CANCELLED |
| `issueDate`          | date   | When the permit was issued                       |
| `effectiveDate`      | date   | When the permit becomes active                   |
| `expiryDate`         | date   | When the permit expires                          |
| `expiresNotified`    | boolean| Whether expiry notifications have been sent      |
| `responsibleMemberId`| string | Project member responsible for this permit       |

# State Machine

    PENDING → APPLIED → ISSUED → ACTIVE
                             ↘ REVOKED
    PENDING, APPLIED, ISSUED, ACTIVE → CANCELLED
    ACTIVE → EXPIRED (automatic, time-based)
    EXPIRED → REVOKED

- **PENDING**: Application not yet submitted.
- **APPLIED**: Application submitted to authority.
- **ISSUED**: Permit approved by authority, not yet in effect.
- **ACTIVE**: Permit is in force.
- **EXPIRED**: Past the expiry date.
- **REVOKED**: Withdrawn by authority.
- **CANCELLED**: Withdrawn by project team.

# Agent Restrictions

Agents CAN: list permits by status, identify expiring permits, report permit coverage.
Agents CANNOT: transition permit status, submit applications, or make regulatory decisions.
