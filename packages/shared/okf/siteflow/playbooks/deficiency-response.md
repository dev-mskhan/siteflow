---
type: Playbook
title: Deficiency Response
description: Steps for responding to quality deficiencies, from identification to closure.
tags: [quality, deficiency, corrective-action]
status: stable
generated: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
verified: { by: human:team-lead, at: 2026-11-02T00:00:00Z }
---

# Trigger

A quality deficiency exists in status OPEN or IN_PROGRESS, especially where severity is HIGH or CRITICAL.

# Steps

1. **Assess severity**: CRITICAL deficiencies require immediate stop-work consideration. HIGH deficiencies require same-day response.
2. **Assign responsibility**: Set `responsibleMemberId` to the appropriate project member.
3. **Set due date**: CRITICAL → same day; HIGH → within 3 days; MEDIUM → within 7 days; LOW → within 30 days.
4. **Create corrective action**: Use the quality module to create a corrective action linked to the deficiency.
5. **Track progress**: Monitor corrective action status through OPEN → IN_PROGRESS → COMPLETED.
6. **Verify**: After corrective action is COMPLETED, an authorized person must verify it (→ VERIFIED).
7. **Close**: Once all corrective actions are VERIFIED, close the deficiency.

# Agent Role

The compliance agent can report on open deficiencies, overdue items, and status trends. It **cannot** create corrective actions, update statuses, or close deficiencies — these require human authorization.

See [quality-deficiencies](/tables/quality-deficiencies.md) for schema details.
