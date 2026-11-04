---
type: Metric
title: Retainage
description: Percentage withheld from progress payments until project milestones are reached, then released.
tags: [finance, billing, retainage]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:cfo, at: 2026-11-02T00:00:00Z }
stale_after: 2027-11-02T00:00:00Z
---

# Definition

Retainage is a portion of each progress payment withheld until a defined milestone (typically substantial completion or final completion).

    retainage_held = sum(payment_application.retainage_withheld)
    retainage_released = sum(payment_application.retainage_released)
    retainage_balance = retainage_held - retainage_released

# Rules

- Retainage is negotiated per contract (commonly 5–10%).
- Once the project reaches substantial completion, retainage may be reduced or released entirely.
- Released retainage is paid via a separate payment application or included in the final application.
- Never confuse retainage held with retainage balance — the balance is what remains after releases.
